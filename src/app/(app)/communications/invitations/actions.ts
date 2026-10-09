"use server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { invitationManager,inviteCandidateWhere,runPortalInvitations } from "@/lib/portal-invitations";
import { revalidatePath } from "next/cache";
export type InvitationState={error?:string;success?:string};
export async function runInvitationAction(_state:InvitationState,_form:FormData):Promise<InvitationState>{
 void _state;void _form;
 const s=await requireSession();if(!(await invitationManager(db,s)))return{error:"Only active owners and administrators may send account invitations."};
 try{const result=await runPortalInvitations(db,s.organizationId);revalidatePath("/communications/invitations");return result.configured?{success:`Invitation run completed: ${result.prepared} records prepared, ${result.accepted} emails accepted by the provider. Check status below; provider acceptance is not confirmed mailbox delivery.`}:{error:"Email sender or invitation configuration is missing."};}catch{return{error:"Invitation processing could not be confirmed. Refresh status before retrying."};}
}
export async function invitationSettingsAction(f:FormData){
 const s=await requireSession();if(!(await invitationManager(db,s)))return;
 const enabled=f.get("inviteEnabled")==="on";
 await db.$transaction(async tx=>{await tx.communicationSettings.upsert({where:{organizationId:s.organizationId},create:{organizationId:s.organizationId,inviteEnabled:enabled},update:{inviteEnabled:enabled}});await tx.auditLog.create({data:{organizationId:s.organizationId,actorUserId:s.userId,action:"TENANT_INVITATION_AUTOMATION_UPDATED",entityType:"Organization",entityId:s.organizationId,metadata:{enabled}}});});revalidatePath("/communications/invitations");
}
export async function reissueInvitationAction(f:FormData){
 const s=await requireSession();if(!(await invitationManager(db,s)))return;const id=String(f.get("id")??"");if(id.length>128)return;
 await db.$transaction(async tx=>{
 const original=await tx.tenantPortalInvitation.findFirst({where:{id,organizationId:s.organizationId}});if(!original)return;
 await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${original.studentId} AND "organizationId"=${s.organizationId} FOR UPDATE`;
 await tx.$queryRaw`SELECT id FROM "TenantPortalInvitation" WHERE id=${id} FOR UPDATE`;
 const row=await tx.tenantPortalInvitation.findFirst({where:{id,organizationId:s.organizationId,usedAt:null,status:{in:["FAILED","MISSING_EMAIL","EXPIRED","INELIGIBLE"]}}});if(!row)return;
 const student=await tx.student.findFirst({where:{...inviteCandidateWhere(s.organizationId),id:row.studentId},select:{id:true}});if(!student)return;
 await tx.tenantPortalInvitation.update({where:{id},data:{generation:{increment:1},status:"QUEUED",tokenHash:null,activationHost:null,recipient:null,sender:null,expiresAt:null,attempts:0,attemptedAt:null,providerId:null,error:null}});
 await tx.auditLog.create({data:{organizationId:s.organizationId,actorUserId:s.userId,action:"TENANT_PORTAL_INVITATION_REISSUED",entityType:"Student",entityId:row.studentId,metadata:{invitationId:id}}});
 });revalidatePath("/communications/invitations");
}
