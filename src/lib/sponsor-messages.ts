import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "./auth/session";
import { tenantWhere } from "./communications";
import { localSessionCurrent } from "./account-security-policy";
import { messagingCountry, messagingProperties } from "./whatsapp-communications";
import { whatsappNumber } from "./whatsapp-policy";
import { readArrears } from "./arrears-reminders";
const schema=z.object({requestId:z.string().uuid(),studentId:z.string().min(1).max(128),name:z.string().trim().min(2).max(100),phone:z.string().trim().min(7).max(30),kind:z.enum(["GENERAL","ARREARS"]),title:z.string().trim().min(3).max(160),body:z.string().trim().max(3000),fingerprint:z.string().optional()});
export async function prepareSponsorMessage(database:PrismaClient,session:SessionPayload|null,input:unknown) {
 if(!session) return {error:"Management sign-in is required."};
 const parsed=schema.safeParse(input);if(!parsed.success) return {error:"Choose one student and enter the recipient’s name and valid mobile number."};
 const value=parsed.data;
 return database.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR UPDATE`;
  const actor=await tx.user.findFirst({where:{id:session.userId,organizationId:session.organizationId,active:true,role:{in:["OWNER","ADMIN","MANAGER"]},organization:{status:"ACTIVE"}},select:{sessionVersion:true}});
  if(!actor||!localSessionCurrent(session.sessionVersion,actor.sessionVersion)) return {error:"Active management access is required."};
  const [student,org,properties]=await Promise.all([tx.student.findFirst({where:{...tenantWhere(session.organizationId),id:value.studentId},select:{fullName:true}}),tx.organization.findUnique({where:{id:session.organizationId},select:{whatsappEnabled:true}}),messagingProperties(tx,session.organizationId)]);
  if(!student) return {error:"Select a current student from this hostel."};
  if(!org?.whatsappEnabled) return {error:"WhatsApp is disabled in hostel settings."};
  const phone=whatsappNumber(value.phone,messagingCountry(properties,session.organizationId));
  if(!phone) return {error:"Enter a valid mobile number, for example 07… or +254… for a Kenyan number."};
  let body=value.body, whatsappBody=`${value.title}\nStudent: ${student.fullName}\n\n${value.body}`;
  if(value.kind==="ARREARS") {
   const current=await readArrears(tx,session.organizationId,new Date(),[value.studentId]);const row=current.rows[0];
   if(!row||current.review.length||row.fingerprint!==value.fingerprint) return {error:"The balance or payment arrangement changed. Refresh and select the student again."};
   body=row.message;whatsappBody=row.whatsappMessage;
  } else if(body.length<10) return {error:"Write a message of at least 10 characters."};
  const id=`sponsor_${value.requestId}`,notificationId=value.kind==="ARREARS"?`arrears_${id}`:id;
  const existing=await tx.tenantMessage.findUnique({where:{organizationId_studentId_dedupKey:{organizationId:session.organizationId,studentId:value.studentId,dedupKey:id}}});
  if(existing) return {reportId:value.requestId,success:"This recipient’s draft is already saved. Open the delivery result below."};
  // One typed recipient per request; never overwrite a student's registered contact.
  if(await tx.notification.findUnique({where:{id:notificationId}})) return {error:"This request was already used. Start a new message to change the student or recipient."};
  await tx.notification.create({data:{id:notificationId,organizationId:session.organizationId,studentId:value.studentId,createdById:session.userId,channel:"WHATSAPP",recipientType:"GUARDIAN",recipientName:value.name,recipientPhone:phone,message:whatsappBody}});
  await tx.tenantMessage.create({data:{id,organizationId:session.organizationId,studentId:value.studentId,batchId:value.requestId,dedupKey:id,title:value.title,body,category:value.kind,whatsappCopy:true,notificationId}});
  await tx.auditLog.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"TYPED_GUARDIAN_MESSAGE_CREATED",entityType:"Notification",entityId:notificationId,metadata:{studentId:value.studentId,recipientPhone:phone,recipientName:value.name}}});
  return {reportId:value.requestId,success:`1 recipient: ${value.name} (+${phone}), for ${student.fullName}. Draft saved; open WhatsApp and tap Send. No phone delivery is confirmed yet.`};
 },{timeout:30000});
}
