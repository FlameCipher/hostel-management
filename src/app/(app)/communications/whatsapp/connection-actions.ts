"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { residentStaff } from "@/lib/resident-access";
import { storeWhatsAppConnection } from "@/lib/whatsapp-cloud";
import { messagingProperties,messagingCountry } from "@/lib/whatsapp-communications";
import { whatsappNumber } from "@/lib/whatsapp-policy";
import { serviceId } from "@/lib/service-security";
const schema=z.object({phoneNumberId:z.string().regex(/^\d{5,30}$/),businessAccountId:z.string().regex(/^\d{5,30}$/),accessToken:z.string().min(20).max(4096),templateName:z.string().regex(/^[a-z0-9_]{1,128}$/),templateLanguage:z.string().regex(/^[a-z]{2}(?:_[A-Z]{2})?$/),apiVersion:z.string().regex(/^v\d{2}\.0$/)});
export async function saveWhatsAppConnection(_state:{error?:string;success?:string},form:FormData):Promise<{error?:string;success?:string}>{
 const session=await requireSession(),staff=await residentStaff(db,session);if(!staff||!["OWNER","ADMIN"].includes(staff.role))return {error:"Only owners and administrators can configure the business sender."};
 if(form.get("pause")==="true"){await db.whatsAppConnection.updateMany({where:{organizationId:session.organizationId},data:{enabled:false}});revalidatePath("/communications/whatsapp");return {success:"Automatic WhatsApp sending is paused."};}
 const parsed=schema.safeParse(Object.fromEntries(form));if(!parsed.success)return {error:"Enter the sender, business account, approved template and current Meta API version."};
 const enabled=form.get("enabled")==="on";if(enabled&&!(process.env.WHATSAPP_APP_SECRET&&process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN))return {error:"The platform's Meta webhook connection must be configured before automatic delivery can be enabled. You can save the sender with automatic delivery unchecked."};
 try{await storeWhatsAppConnection(db,session.organizationId,parsed.data,enabled);await db.auditLog.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"WHATSAPP_SENDER_CONFIGURED",entityType:"Organization",entityId:session.organizationId,metadata:{enabled}}});revalidatePath("/communications/whatsapp");return {success:enabled?"Sender verified. Future eligible messages can now be sent automatically to opted-in recipients.":"Sender verified and saved. Automatic delivery is paused."};}catch{return {error:"Meta could not verify the sender and approved template. Check the IDs, token permissions, API version and template language. Existing settings were kept."};}
}
export async function recordWhatsAppPermission(form:FormData){
 const session=await requireSession(),staff=await residentStaff(db,session,true);if(!staff)return;
 const audience=form.get("audience")==="staff"?"staff":"tenant",accountId=String(form.get("accountId")??""),enabled=form.get("enabled")==="on",evidence=String(form.get("evidence")??"").trim();if(enabled&&(form.get("confirmed")!=="on"||evidence.length<5||evidence.length>300))return;
 const record=audience==="tenant"?await db.student.findFirst({where:{id:accountId,organizationId:session.organizationId,status:"ACTIVE"},select:{phone:true}}):await db.user.findFirst({where:{id:accountId,organizationId:session.organizationId,active:true},select:{phone:true}});if(!record)return;
 const properties=await messagingProperties(db,session.organizationId),phone=whatsappNumber(record.phone,messagingCountry(properties,session.organizationId));if(!phone)return;
 const key={organizationId:session.organizationId,accountId,audience};
 await db.$transaction(async tx=>{await tx.whatsAppConsent.upsert({where:{organizationId_accountId_audience:key},create:{id:serviceId(...Object.values(key)),...key,phone,enabled,consentText:evidence||"Management recorded withdrawal."},update:{phone,enabled,consentText:evidence||"Management recorded withdrawal."}});await tx.auditLog.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"WHATSAPP_PERMISSION_RECORDED",entityType:"WhatsAppConsent",entityId:serviceId(...Object.values(key)),metadata:{audience,enabled}}});});revalidatePath("/communications/whatsapp");
}
