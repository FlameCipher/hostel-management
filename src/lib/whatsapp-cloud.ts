import { createHmac,timingSafeEqual } from "node:crypto";
import type { PrismaClient,WhatsAppConnection,Notification } from "@/generated/prisma/client";
import { openServiceSecret,sealServiceSecret,serviceId } from "./service-security";
import { messagingProperties,messagingCountry } from "./whatsapp-communications";
import { whatsappNumber } from "./whatsapp-policy";
import { tenantWhere } from "./communications";
import { newReceiptLink } from "./short-receipt-link";
import { propertyTenantLogin } from "./whatsapp-policy";

export function webhookSignature(body:string,signature:string|null,secret=process.env.WHATSAPP_APP_SECRET){
 if(!secret||!signature||!/^sha256=[a-f0-9]{64}$/.test(signature))return false;
 return timingSafeEqual(Buffer.from(signature.slice(7),"hex"),createHmac("sha256",secret).update(body).digest());
}
export function cloudTemplate(connection:Pick<WhatsAppConnection,"templateName"|"templateLanguage">,recipient:string,message:string){
 if(message.length>1000)throw Error("TEMPLATE_MESSAGE_TOO_LONG");
 return {messaging_product:"whatsapp",to:recipient,type:"template",template:{name:connection.templateName,language:{code:connection.templateLanguage},components:[{type:"body",parameters:[{type:"text",text:message}]}]}};
}
export async function verifyWhatsAppConnection(input:{phoneNumberId:string;businessAccountId:string;accessToken:string;templateName:string;templateLanguage:string;apiVersion:string}){
 const base=`https://graph.facebook.com/${input.apiVersion}`;const headers={Authorization:`Bearer ${input.accessToken}`};
 const [phone,templates]=await Promise.all([fetch(`${base}/${input.phoneNumberId}?fields=display_phone_number,verified_name`,{headers,signal:AbortSignal.timeout(10000)}),fetch(`${base}/${input.businessAccountId}/message_templates?name=${encodeURIComponent(input.templateName)}&fields=name,language,status,components`,{headers,signal:AbortSignal.timeout(10000)})]);
 if(!phone.ok||!templates.ok)throw Error("META_VERIFICATION_FAILED");
 const number=await phone.json(),items=await templates.json();const match=items.data?.find((t:{name:string;language:string;status:string;components?:Array<{type:string;text?:string}>})=>t.name===input.templateName&&t.language===input.templateLanguage&&t.status==="APPROVED");
 // This integration uses one positional body parameter and no media/header/button variables.
 if(!match||match.components?.some((c:{type:string;text?:string})=>c.type!=="BODY"&&c.type!=="FOOTER")||!match.components?.some((c:{type:string;text?:string})=>c.type==="BODY"&&c.text?.includes("{{1}}")&&!/\{\{(?!1\}\})/.test(c.text)))throw Error("APPROVED_TEMPLATE_REQUIRED");
 if(typeof number.display_phone_number!=="string")throw Error("SENDER_NOT_VERIFIED");return number.display_phone_number as string;
}
export async function storeWhatsAppConnection(db:PrismaClient,organizationId:string,input:Parameters<typeof verifyWhatsAppConnection>[0],enabled:boolean){
 const displayPhone=await verifyWhatsAppConnection(input);
 const data={phoneNumberId:input.phoneNumberId,businessAccountId:input.businessAccountId,apiVersion:input.apiVersion,displayPhone,accessToken:sealServiceSecret(input.accessToken,organizationId),templateName:input.templateName,templateLanguage:input.templateLanguage,enabled,verifiedAt:new Date()};
 await db.whatsAppConnection.upsert({where:{organizationId},create:{organizationId,...data},update:data});
}
export async function consentedRecipient(db:PrismaClient,item:Pick<Notification,"organizationId"|"recipientType"|"studentId"|"recipientStaffId"|"recipientPhone">&{createdAt?:Date}){
 const properties=await messagingProperties(db,item.organizationId),country=messagingCountry(properties,item.organizationId);
 if(item.recipientType==="GUARDIAN")return null;
 const tenant=item.recipientType==="STUDENT",id=tenant?item.studentId:item.recipientStaffId;if(!id)return null;
 const record=tenant?await db.student.findFirst({where:{...tenantWhere(item.organizationId),id},select:{phone:true}}):await db.user.findFirst({where:{id,organizationId:item.organizationId,active:true},select:{phone:true}});
 const phone=whatsappNumber(record?.phone,country);if(!phone||phone!==whatsappNumber(item.recipientPhone,country))return null;
 const consent=await db.whatsAppConsent.findFirst({where:{organizationId:item.organizationId,accountId:id,audience:tenant?"tenant":"staff",phone,enabled:true,...(item.createdAt?{updatedAt:{lte:item.createdAt}}:{})}});return consent?phone:null;
}
export async function queueAccountWhatsApps(db:PrismaClient,connection:WhatsAppConnection){
 if(!connection.enabled||!connection.verifiedAt)return;
 const properties=await messagingProperties(db,connection.organizationId),login=propertyTenantLogin(properties),origin=new URL(login).origin;
 const payments=await db.$queryRaw<Array<{id:string}>>`SELECT p.id FROM "Payment" p WHERE p."organizationId"=${connection.organizationId} AND p."createdAt">=${connection.verifiedAt} AND p."reversedAt" IS NULL AND EXISTS(SELECT 1 FROM "WhatsAppConsent" c WHERE c."organizationId"=p."organizationId" AND c."accountId"=p."studentId" AND c.audience='tenant' AND c.enabled=true AND p."createdAt">=c."updatedAt") AND NOT EXISTS(SELECT 1 FROM "Notification" n WHERE n.id='wa_receipt_'||p.id) ORDER BY p."createdAt" LIMIT 50`;
 for(const candidate of payments){const payment=await db.payment.findFirst({where:{id:candidate.id,organizationId:connection.organizationId,reversedAt:null},include:{student:true}});if(!payment)continue;const recipient=await consentedRecipient(db,{organizationId:connection.organizationId,recipientType:"STUDENT",studentId:payment.studentId,recipientStaffId:null,recipientPhone:payment.student.phone});if(!recipient)continue;
  await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Payment" WHERE id=${payment.id} FOR UPDATE`;if(!await tx.payment.findFirst({where:{id:payment.id,organizationId:connection.organizationId,reversedAt:null}}))return;const id=`wa_receipt_${payment.id}`;if(await tx.notification.findUnique({where:{id}}))return;const link=newReceiptLink();await tx.paymentReceiptLink.create({data:{codeHash:link.codeHash,paymentId:payment.id,expiresAt:link.expiresAt}});await tx.notification.create({data:{id,organizationId:connection.organizationId,studentId:payment.studentId,channel:"WHATSAPP",recipientType:"STUDENT",recipientName:payment.student.fullName,recipientPhone:recipient,message:`Your hostel payment receipt is ready. Download the PDF: ${origin}/r/${link.code}\nIf you do not recognize this payment, contact management.`}});});
 }
 const invitations=await db.$queryRaw<Array<{id:string}>>`SELECT i.id FROM "TenantPortalInvitation" i WHERE i."organizationId"=${connection.organizationId} AND i."createdAt">=${connection.verifiedAt} AND i."usedAt" IS NULL AND i."expiresAt">now() AND EXISTS(SELECT 1 FROM "WhatsAppConsent" c WHERE c."organizationId"=i."organizationId" AND c."accountId"=i."studentId" AND c.audience='tenant' AND c.enabled=true AND i."createdAt">=c."updatedAt") AND NOT EXISTS(SELECT 1 FROM "Notification" n WHERE n.id='wa_invite_'||i.id||'_'||i.generation::text) ORDER BY i."createdAt" LIMIT 50`;
 for(const candidate of invitations){const invitation=await db.tenantPortalInvitation.findFirst({where:{id:candidate.id,organizationId:connection.organizationId},include:{student:true}});if(!invitation)continue;const recipient=await consentedRecipient(db,{organizationId:connection.organizationId,recipientType:"STUDENT",studentId:invitation.studentId,recipientStaffId:null,recipientPhone:invitation.student.phone});if(!recipient)continue;await db.notification.createMany({data:[{id:`wa_invite_${invitation.id}_${invitation.generation}`,organizationId:connection.organizationId,studentId:invitation.studentId,channel:"WHATSAPP",recipientType:"STUDENT",recipientName:invitation.student.fullName,recipientPhone:recipient,message:`Your hostel invites you to use your tenant account. Sign in: ${login}\nIf you do not have an account, choose Create my tenant account. Management will verify your tenancy. Never share your password.`}],skipDuplicates:true});}
}
export async function sendWhatsAppTemplate(connection:WhatsAppConnection,recipient:string,message:string){
 const response=await fetch(`https://graph.facebook.com/${connection.apiVersion}/${connection.phoneNumberId}/messages`,{method:"POST",headers:{Authorization:`Bearer ${openServiceSecret(connection.accessToken,connection.organizationId)}`,"Content-Type":"application/json"},body:JSON.stringify(cloudTemplate(connection,recipient,message)),signal:AbortSignal.timeout(12000)});
 const result=await response.json().catch(()=>null);
 if(!response.ok){const error=new Error("META_REJECTED") as Error&{definite?:boolean;retry?:boolean};error.definite=response.status>=400&&response.status<500;error.retry=response.status===429;throw error;}
 const id=result?.messages?.[0]?.id;if(typeof id!=="string")throw Error("META_ACCEPTANCE_UNCONFIRMED");return id;
}
export async function runWhatsAppDelivery(db:PrismaClient,send=sendWhatsAppTemplate,now=new Date()){
 if(!process.env.WHATSAPP_APP_SECRET||!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN||!process.env.SERVICE_ENCRYPTION_KEY)return {configured:false,queued:0,sent:0,failed:0};
 let queued=0,sent=0,failed=0;
 const connections=await db.whatsAppConnection.findMany({where:{enabled:true,organization:{status:"ACTIVE",whatsappEnabled:true}}});
 for(const connection of connections){
  if(!connection.verifiedAt)continue;
  await queueAccountWhatsApps(db,connection);
  const candidates=await db.$queryRaw<Array<{id:string}>>`SELECT n.id FROM "Notification" n WHERE n."organizationId"=${connection.organizationId} AND n.channel='WHATSAPP' AND n.status='QUEUED' AND n."createdAt">=${connection.verifiedAt} AND n."scheduledAt"<=${now} AND NOT EXISTS(SELECT 1 FROM "WhatsAppDelivery" d WHERE d."notificationId"=n.id) AND EXISTS(SELECT 1 FROM "WhatsAppConsent" c WHERE c."organizationId"=n."organizationId" AND c.enabled=true AND n."createdAt">=c."updatedAt" AND ((n."recipientType"='STUDENT' AND c.audience='tenant' AND c."accountId"=n."studentId") OR (n."recipientType"='STAFF' AND c.audience='staff' AND c."accountId"=n."recipientStaffId"))) ORDER BY n."createdAt" LIMIT 100`;
  const items=await db.notification.findMany({where:{id:{in:candidates.map(c=>c.id)},organizationId:connection.organizationId}});
  for(const item of items){const recipient=await consentedRecipient(db,item);if(!recipient)continue;queued+=(await db.whatsAppDelivery.createMany({data:[{id:serviceId("wa-cloud",item.id),organizationId:item.organizationId,notificationId:item.id,phoneNumberId:connection.phoneNumberId,recipient}],skipDuplicates:true})).count;}
 }
 // A timeout may occur after acceptance. Reconcile before any retry to avoid duplicate WhatsApps.
 await db.whatsAppDelivery.updateMany({where:{status:"SENDING",attemptAt:{lt:new Date(now.getTime()-15*60000)}},data:{status:"REVIEW",error:"Send outcome is uncertain. Check Meta delivery logs before retrying."}});
 const jobs=await db.whatsAppDelivery.findMany({where:{status:"QUEUED",attempts:{lt:3},nextAttemptAt:{lte:now}},orderBy:{createdAt:"asc"},take:30});
 for(const job of jobs){
  const connection=connections.find(c=>c.organizationId===job.organizationId&&c.phoneNumberId===job.phoneNumberId);const item=await db.notification.findFirst({where:{id:job.notificationId,organizationId:job.organizationId,status:"QUEUED"}});
  if(!connection||!item||await consentedRecipient(db,item)!==job.recipient){await db.whatsAppDelivery.update({where:{id:job.id},data:{status:"CANCELLED"}});continue;}
  if(item.message.length>1000){await db.whatsAppDelivery.update({where:{id:job.id},data:{status:"FAILED",error:"Message exceeds the approved template limit. Use a shorter message or send the manual draft."}});continue;}
  const claimed=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Notification" WHERE id=${item.id} AND "organizationId"=${item.organizationId} FOR UPDATE`;
   if(!await tx.notification.findFirst({where:{id:item.id,organizationId:item.organizationId,status:"QUEUED"}}))return false;
   return (await tx.whatsAppDelivery.updateMany({where:{id:job.id,status:"QUEUED",attempts:job.attempts},data:{status:"SENDING",attemptAt:now,attempts:{increment:1}}})).count>0;
  });if(!claimed)continue;
  try{const providerId=await send(connection,job.recipient,item.message);await db.$transaction(async tx=>{await tx.whatsAppDelivery.update({where:{id:job.id},data:{status:"ACCEPTED",providerId,error:null}});await tx.notification.update({where:{id:item.id},data:{status:"SENT",sentAt:new Date()}});});sent++;}
  catch(error){const e=error as {definite?:boolean;retry?:boolean};const retry=e.definite&&e.retry&&job.attempts<2;await db.whatsAppDelivery.update({where:{id:job.id},data:{status:retry?"QUEUED":e.definite?"FAILED":"REVIEW",nextAttemptAt:new Date(now.getTime()+5*60000),error:e.definite?"Meta rejected this message. Review sender, template and recipient settings.":"Send outcome is uncertain. Review Meta logs before sending again."}});failed++;}
 }
 return {configured:connections.length>0,queued,sent,failed};
}
export async function recordWhatsAppStatus(db:PrismaClient,phoneNumberId:string,status:{id?:string;status?:string;recipient_id?:string}){
 if(!status.id||!status.recipient_id)return;
 const rank:Record<string,number>={ACCEPTED:0,SENT:1,DELIVERED:2,READ:3};const value=(status.status??"").toUpperCase();if(!["SENT","DELIVERED","READ","FAILED"].includes(value))return;
 await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "WhatsAppDelivery" WHERE "providerId"=${status.id} AND "phoneNumberId"=${phoneNumberId} FOR UPDATE`;const item=await tx.whatsAppDelivery.findFirst({where:{providerId:status.id,phoneNumberId,recipient:status.recipient_id}});if(!item||rank[item.status]>=(rank[value]??-1)&&value!=="FAILED"||value==="FAILED"&&["DELIVERED","READ"].includes(item.status))return;await tx.whatsAppDelivery.update({where:{id:item.id},data:{status:value,...(["DELIVERED","READ"].includes(value)?{deliveredAt:item.deliveredAt??new Date()}:{}),...(value==="READ"?{readAt:new Date()}:{}),error:value==="FAILED"?"Meta reported delivery failure.":null}});});
}
