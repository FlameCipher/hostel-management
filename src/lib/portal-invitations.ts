import { createHmac,createHash,randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import type { Prisma,PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { tenantWhere } from "@/lib/communications";
import { emailResult } from "@/lib/communication-email";
export const invitationLifetime=72*60*60*1000;
export function invitationHash(token:string){return createHash("sha256").update(token).digest("hex");}
export function invitationToken(row:{id:string;generation:number;recipient:string|null;expiresAt:Date|null},secret:string){
 if(!row.recipient || !row.expiresAt || secret.length<16)throw Error("Invitation configuration incomplete");
 return row.id+"."+createHmac("sha256",secret).update(JSON.stringify([row.id,row.generation,row.recipient,row.expiresAt.toISOString()])).digest("base64url");
}
export function inviteCandidateWhere(organizationId:string):Prisma.StudentWhereInput{
 return {...tenantWhere(organizationId),organization:{status:"ACTIVE"},portalEnabled:false,portalPasswordHash:null,portalLastLoginAt:null,portalInviteBlocked:false};
}
export async function invitationManager(db:Pick<PrismaClient,"user">,s:SessionPayload|null){
 if(!s)return null;return db.user.findFirst({where:{id:s.userId,organizationId:s.organizationId,active:true,role:{in:["OWNER","ADMIN"]}},select:{id:true}});
}
export async function usableInvitation(db:Pick<PrismaClient,"tenantPortalInvitation"|"student">,token:string,now=new Date()){
 if(!/^[a-zA-Z0-9-]{1,64}\.[A-Za-z0-9_-]{43}$/.test(token))return null;
 const row=await db.tenantPortalInvitation.findUnique({where:{tokenHash:invitationHash(token)}});
 if(!row || row.usedAt || !row.expiresAt || row.expiresAt<=now || !row.recipient)return null;
 const student=await db.student.findFirst({where:{...inviteCandidateWhere(row.organizationId),id:row.studentId},select:{id:true,email:true}});
 if(!student?.email || student.email.trim().toLowerCase()!==row.recipient.toLowerCase())return null;
 return row;
}
export async function activateInvitation(db:PrismaClient,input:unknown,now=new Date()){
 const parsed=z.object({token:z.string().max(128),password:z.string().min(10).max(128),confirmation:z.string()}).refine(x=>x.password===x.confirmation).safeParse(input);
 if(!parsed.success)return{error:"Use matching passwords of 10–128 characters."};
 const initial=await usableInvitation(db,parsed.data.token,now);if(!initial)return{error:"This invitation is unavailable, expired or already used. Contact management for a new link."};
 const passwordHash=await hash(parsed.data.password,12);
 return db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${initial.studentId} AND "organizationId"=${initial.organizationId} FOR UPDATE`;
 await tx.$queryRaw`SELECT id FROM "TenantPortalInvitation" WHERE id=${initial.id} FOR UPDATE`;
 const row=await usableInvitation(tx,parsed.data.token,new Date());if(!row)return{error:"This invitation is unavailable, expired or already used."};
 const changed=await tx.student.updateMany({where:{...inviteCandidateWhere(row.organizationId),id:row.studentId},data:{portalPasswordHash:passwordHash,portalEnabled:true}});if(changed.count!==1)return{error:"Account activation is unavailable."};
 await tx.tenantPortalInvitation.update({where:{id:row.id},data:{usedAt:new Date(),status:"ACTIVATED",tokenHash:null}});
 await tx.auditLog.create({data:{organizationId:row.organizationId,action:"TENANT_PORTAL_SELF_ACTIVATED",entityType:"Student",entityId:row.studentId,metadata:{invitationId:row.id}}});
 return{success:"Your account is ready. Sign in with your registered mobile number or email and your new password."};
 });
}
export async function runPortalInvitations(db:PrismaClient,organizationId?:string,now=new Date(),fetcher:typeof fetch=fetch,config={apiKey:process.env.RESEND_API_KEY,from:process.env.RECEIPT_EMAIL_FROM,secret:process.env.SESSION_SECRET}){
 if(!config.apiKey || !config.from || !config.secret || config.secret.length<16)return{configured:false,accepted:0,prepared:0};
 let prepared=0,accepted=0;
 const settings=await db.communicationSettings.findMany({where:{inviteEnabled:true,...(organizationId?{organizationId}:{}),organization:{status:"ACTIVE"}},include:{organization:{select:{name:true}}}});
 for(const rule of settings){
 const students=await db.student.findMany({where:{...inviteCandidateWhere(rule.organizationId),portalInvitations:{none:{}}},select:{id:true,email:true},orderBy:{id:"asc"},take:30});
 for(const s of students){const result=await db.tenantPortalInvitation.createMany({data:{id:randomUUID(),organizationId:rule.organizationId,studentId:s.id,hostelName:rule.organization.name,status:s.email&&z.string().email().safeParse(s.email.trim()).success?"QUEUED":"MISSING_EMAIL",error:s.email&&z.string().email().safeParse(s.email.trim()).success?null:"Add a valid student email for automatic delivery."},skipDuplicates:true});prepared+=result.count;}
 await db.tenantPortalInvitation.updateMany({where:{organizationId:rule.organizationId,usedAt:null,expiresAt:{lte:now},status:{notIn:["ACTIVATED","EXPIRED"]}},data:{status:"EXPIRED",tokenHash:null,error:"Invitation expired. Management can issue a new link."}});
 const repaired=await db.tenantPortalInvitation.findMany({where:{organizationId:rule.organizationId,status:"MISSING_EMAIL",student:{email:{not:null}}},include:{student:{select:{email:true}}},take:1000});
 for(const candidate of repaired)if(candidate.student.email&&z.string().email().safeParse(candidate.student.email.trim()).success)await db.tenantPortalInvitation.updateMany({where:{id:candidate.id,status:"MISSING_EMAIL"},data:{status:"QUEUED",error:null}});
 const pending=await db.tenantPortalInvitation.findMany({where:{organizationId:rule.organizationId,status:{in:["QUEUED","RETRY"]},attempts:{lt:3},OR:[{attemptedAt:null},{attemptedAt:{lte:new Date(now.getTime()-3600000)}}]},select:{id:true},orderBy:{createdAt:"asc"},take:30});
 for(const candidate of pending){
 const item=await db.$transaction(async tx=>{
 const initial=await tx.tenantPortalInvitation.findUnique({where:{id:candidate.id}});if(!initial)return null;
 await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${initial.studentId} AND "organizationId"=${rule.organizationId} FOR UPDATE`;
 await tx.$queryRaw`SELECT id FROM "TenantPortalInvitation" WHERE id=${initial.id} FOR UPDATE`;
 const row=await tx.tenantPortalInvitation.findUnique({where:{id:initial.id}});if(!row || row.usedAt || !["QUEUED","RETRY","MISSING_EMAIL"].includes(row.status)||row.attempts>=3)return null;
 const student=await tx.student.findFirst({where:{...inviteCandidateWhere(rule.organizationId),id:row.studentId},select:{email:true}});
 if(!student){await tx.tenantPortalInvitation.update({where:{id:row.id},data:{status:"INELIGIBLE",tokenHash:null,error:"Tenant is no longer eligible for automatic activation."}});return null;}
 const email=student.email?.trim().toLowerCase();if(!email || !z.string().email().safeParse(email).success){await tx.tenantPortalInvitation.update({where:{id:row.id},data:{status:"MISSING_EMAIL",error:"Add a valid student email for automatic delivery."}});return null;}
 if(row.recipient && row.recipient!==email){await tx.tenantPortalInvitation.update({where:{id:row.id},data:{status:"FAILED",tokenHash:null,error:"Student email changed. Issue a new invitation."}});return null;}
 const expiresAt=row.expiresAt??new Date(now.getTime()+invitationLifetime),recipient=row.recipient??email;
 const token=invitationToken({...row,recipient,expiresAt},config.secret!);
 if(row.tokenHash && row.tokenHash!==invitationHash(token)){await tx.tenantPortalInvitation.update({where:{id:row.id},data:{status:"FAILED",tokenHash:null,error:"Invitation configuration changed. Issue a new invitation."}});return null;}
 const claimed=await tx.tenantPortalInvitation.update({where:{id:row.id},data:{status:"SENDING",recipient,sender:row.sender??config.from,expiresAt,tokenHash:invitationHash(token),attempts:{increment:1},attemptedAt:now,error:null}});
 return{row:claimed,token};
 });if(!item)continue;
 let result:{status:string;error:string|null}={status:"REVIEW",error:"Email acceptance is uncertain. Review provider status before issuing a new invitation."},providerId:string|undefined;
 try{
 const response=await fetcher("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json","Idempotency-Key":`hostel-invite/${item.row.id}/${item.row.generation}`},body:JSON.stringify({from:item.row.sender,to:[item.row.recipient],subject:`Create your ${item.row.hostelName} tenant account`,text:`${item.row.hostelName} invites you to create your registered tenant account.\n\nSet your own password using this private, one-use link:\nhttps://hostel.sampesa.com/tenant/activate/${item.token}\n\nThe link expires at ${item.row.expiresAt!.toISOString()} (UTC). Do not forward it. After activation, sign in with your registered mobile number or email, read and accept the hostel terms, view your statement and contact management. No password is included in this message. If you did not request accommodation, contact hostel management.`}),signal:AbortSignal.timeout(10000)});
 if(response.ok){const payload=await response.json();providerId=typeof payload.id==="string"?payload.id:undefined;}
 result=emailResult(response.status,providerId);if(result.status==="RETRY"&&item.row.attempts>=3)result={status:"FAILED",error:"Invitation email retry limit reached."};
 }catch{/* Never retry an ambiguous send automatically. */}
 await db.tenantPortalInvitation.updateMany({where:{id:item.row.id,status:"SENDING",usedAt:null},data:{status:result.status,providerId,error:result.error}});if(result.status==="PROVIDER_ACCEPTED")accepted++;
 }
 }
 return{configured:true,prepared,accepted};
}
