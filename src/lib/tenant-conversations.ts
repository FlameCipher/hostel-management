import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantSession } from "@/lib/auth/tenant-session";
import type { SessionPayload } from "@/lib/auth/session";
import { communicationManager, tenantWhere } from "@/lib/communications";
import { z } from "zod";
const inputSchema=z.object({subject:z.string().trim().min(3).max(160),body:z.string().trim().min(3).max(3000),category:z.enum(["QUESTION","MAINTENANCE","PAYMENT","COMPLAINT","OTHER"]),requestId:z.string().uuid()});
const entrySchema=z.object({conversationId:z.string().min(1).max(128),body:z.string().trim().min(3).max(3000),requestId:z.string().uuid()});
export async function tenantContactAccount(db:Pick<PrismaClient,"student">,s:TenantSession|null){
 if(!s)return null;
 return db.student.findFirst({where:{...tenantWhere(s.organizationId),id:s.studentId,portalEnabled:true},select:{id:true}});
}
export async function createConversation(db:PrismaClient,s:TenantSession|null,input:unknown){
 const parsed=inputSchema.safeParse(input);if(!parsed.success)return{error:"Enter a subject and message, and choose a request type."};
 if(!s)return{error:"Only current tenants with portal access can contact management."};
 return db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${s.studentId} AND "organizationId"=${s.organizationId} FOR UPDATE`;
 if(!(await tenantContactAccount(tx as unknown as PrismaClient,s)))return{error:"Only current tenants with portal access can contact management."};
 const previous=await tx.tenantConversationEntry.findUnique({where:{requestId:parsed.data.requestId},include:{conversation:true}});
 if(previous)return previous.conversation.organizationId===s.organizationId && previous.conversation.studentId===s.studentId?{success:"Your message is already saved."}:{error:"Please refresh and try again."};
 const recent=await tx.tenantConversationEntry.count({where:{author:"STUDENT",createdAt:{gte:new Date(Date.now()-60000)},conversation:{organizationId:s.organizationId,studentId:s.studentId}}});
 if(recent>=5)return{error:"Please wait a minute before sending another message."};
 const c=await tx.tenantConversation.create({data:{organizationId:s.organizationId,studentId:s.studentId,subject:parsed.data.subject,category:parsed.data.category,entries:{create:{requestId:parsed.data.requestId,author:"STUDENT",body:parsed.data.body}}}});
 await tx.auditLog.create({data:{organizationId:s.organizationId,action:"TENANT_CONTACT_CREATED",entityType:"TenantConversation",entityId:c.id,metadata:{studentId:s.studentId,category:parsed.data.category}}});
 return{success:"Your message has been sent to management."};
 });
}
export async function replyConversation(db:PrismaClient,s:TenantSession|SessionPayload|null,input:unknown,manager:boolean){
 const parsed=entrySchema.safeParse(input);if(!parsed.success)return{error:"Enter a reply of 3–3,000 characters."};
 if(!s)return{error:"Conversation unavailable."};
 if(manager){if(!(await communicationManager(db,s as SessionPayload)))return{error:"Conversation unavailable."};}
 else if(!(await tenantContactAccount(db,s as TenantSession)))return{error:"Conversation unavailable."};
 return db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "TenantConversation" WHERE id=${parsed.data.conversationId} AND "organizationId"=${s.organizationId} FOR UPDATE`;
 const c=await tx.tenantConversation.findFirst({where:{id:parsed.data.conversationId,organizationId:s.organizationId,...(manager?{}:{studentId:(s as TenantSession).studentId})}});if(!c)return{error:"Conversation unavailable."};
 const account=await tx.student.findFirst({where:{...tenantWhere(c.organizationId),id:c.studentId,portalEnabled:true},select:{id:true}});if(!account)return{error:"This tenant account is no longer eligible for messaging."};
 const previous=await tx.tenantConversationEntry.findUnique({where:{requestId:parsed.data.requestId}});if(previous)return previous.conversationId===c.id?{success:"Your reply is already saved."}:{error:"Please refresh and try again."};
 const recent=await tx.tenantConversationEntry.count({where:{conversationId:c.id,author:manager?"MANAGEMENT":"STUDENT",createdAt:{gte:new Date(Date.now()-60000)}}});if(recent>=5)return{error:"Please wait a minute before sending another reply."};
 await tx.tenantConversationEntry.create({data:{conversationId:c.id,requestId:parsed.data.requestId,author:manager?"MANAGEMENT":"STUDENT",authorUserId:manager?(s as SessionPayload).userId:null,body:parsed.data.body}});
 await tx.tenantConversation.update({where:{id:c.id},data:{status:manager?"REPLIED":"OPEN",updatedAt:new Date()}});
 const settings=manager?await tx.communicationSettings.findUnique({where:{organizationId:c.organizationId}}):null;
 if(manager)await tx.tenantMessage.create({data:{organizationId:c.organizationId,studentId:c.studentId,batchId:parsed.data.requestId,dedupKey:parsed.data.requestId,title:"Management replied: "+c.subject,body:"Management has replied to your private conversation. Open Contact management in your tenant account to read and respond.",category:"REPLY",whatsappCopy:settings?.whatsappCopies??false,emailCopy:settings?.emailCopies??false,emailStatus:settings?.emailCopies?"QUEUED":"NOT_REQUESTED"}});
 await tx.auditLog.create({data:{organizationId:c.organizationId,actorUserId:manager?(s as SessionPayload).userId:undefined,action:manager?"MANAGEMENT_CONTACT_REPLIED":"TENANT_CONTACT_REPLIED",entityType:"TenantConversation",entityId:c.id,metadata:{studentId:c.studentId}}});
 return{success:"Your reply has been saved."};
 });
}
