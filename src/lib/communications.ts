import { agreementActive } from "./payment-agreement-policy";
import { formatMoney, minorUnits, currencyDigits } from "@/lib/currency";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { propertyTenantLogin } from "@/lib/whatsapp-policy";

export const communicationSchema = z.object({
 title: z.string().trim().min(3).max(160), body: z.string().trim().min(10).max(3000),
 audience: z.enum(["ALL", "SELECTED", "MALE", "FEMALE", "UNPAID"]), studentIds: z.array(z.string().min(1).max(128)).max(5000),
 category: z.enum(["GENERAL", "EXAM", "HOLIDAY", "BALANCE"]),
 publishAt: z.date(), email: z.boolean().default(false), whatsapp: z.boolean(), requestId: z.string().uuid(),
 // Optional for non-UI internal callers. The management composer always sends
 // its reviewed preview count, and publishing fails closed when records change.
 reviewedStudentIds: z.array(z.string().min(1).max(128)).max(5000).optional(),
 expectedRecipientCount: z.number().int().min(1).max(5000).optional(),
});
export function tenantWhere(organizationId: string): Prisma.StudentWhereInput {
 return { organizationId, status: "ACTIVE", occupancies: { some: { organizationId, status: { in: ["ACTIVE", "RESERVED"] }, room: { organizationId }, semester: { organizationId } } } };
}
export async function communicationManager(database: Pick<PrismaClient, "user">, session: SessionPayload | null) {
 if (!session) return null;
 return database.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, active: true, role: { in: ["OWNER", "ADMIN", "MANAGER"] } }, select: { id: true } });
}
export function nairobiDay(now: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
export function scheduledDate(value: string, now = new Date()) {
 if (!value) return now;
 if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
 const date = new Date(value + ":00+03:00");
 return Number.isFinite(date.getTime()) && date >= now && date.getTime() <= now.getTime() + 366*86400000 ? date : null;
}
export function outstanding(amount: string | number, payments: Array<{ amount: { toString(): string } }>, currency = "KES") {
 const cents = (value: string) => minorUnits(Number(value), currency);
 return Math.max(0, cents(String(amount)) - payments.reduce((sum,p) => sum+cents(p.amount.toString()),0))/10 ** currencyDigits(currency);
}
async function addMessage(tx: Prisma.TransactionClient, data: { organizationId: string; studentId: string; batchId: string; dedupKey: string; title: string; body: string; category: string; publishAt: Date; whatsappCopy: boolean; emailCopy: boolean }) {
 const rows = await tx.tenantMessage.createMany({ data: { ...data, emailStatus:data.emailCopy?"QUEUED":"NOT_REQUESTED", id: randomUUID() }, skipDuplicates: true });
 return rows.count;
}
export async function publishCommunication(database: PrismaClient, session: SessionPayload | null, input: unknown) {
 if (!(await communicationManager(database,session)) || !session) return { error: "Only active management can publish communications." };
 const parsed = communicationSchema.safeParse(input);
 if (!parsed.success) return { error: "Check the title, message, recipients and schedule." };
 const value=parsed.data;
 if (value.category === "BALANCE") return { error: "Use Unpaid rent reminders to check overdue balances and approved payment dates before sending." };
 if(value.audience === "SELECTED" && !value.studentIds.length) return { error: "Select at least one tenant." };
 return database.$transaction(async tx => {
 const org=await tx.organization.findUnique({where:{id:session.organizationId},select:{whatsappEnabled:true}});
 if(value.whatsapp && !org?.whatsappEnabled) return {error:"Enable WhatsApp in Settings first."};
 const ids=[...new Set(value.studentIds)];
 const overdueIds = value.audience === "UNPAID" ? (await (await import("./arrears-reminders")).readArrears(tx,session.organizationId)).rows.map(row=>row.studentId) : [];

 const students=await tx.student.findMany({where:{...tenantWhere(session.organizationId), ...(value.audience === "UNPAID" ? {id:{in:overdueIds}} : value.audience === "SELECTED" ? {id:{in:ids}} : value.audience === "MALE" || value.audience === "FEMALE" ? {gender:value.audience} : {})},select:{id:true,portalEnabled:true,portalPasswordHash:true},take:5001});
 if(!students.length || students.length>5000 || (value.audience === "SELECTED" && students.length !== ids.length)) return {error:"Recipients must be current tenants of this hostel. Maximum 5,000 recipients."};
 if(value.expectedRecipientCount!==undefined && students.length!==value.expectedRecipientCount)
   return {error:"The recipient register changed since your review. Refresh the notice, check the recipients again, and confirm before saving."};
 if(value.reviewedStudentIds && (new Set(value.reviewedStudentIds).size !== students.length || students.some(student=>!value.reviewedStudentIds!.includes(student.id)))) return {error:"The selected audience changed. Refresh and review the recipients again."};
 const accessiblePortals=students.filter(student=>student.portalEnabled && student.portalPasswordHash!==null).length;
 const awaitingPortal=students.length-accessiblePortals;
 let added=0;
 for(const student of students) added+=await addMessage(tx,{organizationId:session.organizationId,studentId:student.id,batchId:value.requestId,dedupKey:value.requestId,title:value.title,body:value.body,category:value.audience==="UNPAID"?"BALANCE":value.category,publishAt:value.publishAt,whatsappCopy:value.whatsapp,emailCopy:value.email});
 if(added) await tx.auditLog.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"TENANT_COMMUNICATION_PUBLISHED",entityType:"TenantMessage",entityId:value.requestId,metadata:{recipients:added,audience:value.audience,publishAt:value.publishAt.toISOString(),activePortals:accessiblePortals,withoutActivePortal:awaitingPortal,emailCopyRequested:value.email,whatsappDraftRequested:value.whatsapp}}});
 return {reportId:value.requestId,success:`Saved ${students.length} private tenant notice${students.length===1?"":"s"}; ${accessiblePortals} recipient${accessiblePortals===1?"":"s"} currently ${accessiblePortals===1?"has":"have"} portal access, and ${awaitingPortal} cannot read their hostel inbox until activated. ${value.publishAt > new Date() ? "Inbox publication is scheduled." : "Inbox records are available to activated accounts."} ${value.email ? "Email copies requested for queue processing, not confirmed delivered." : "No email copies requested."} ${value.whatsapp ? "WhatsApp copies requested as drafts, not sent." : "No WhatsApp copies requested."} Check actual delivery and read statuses before treating anyone as notified.`};
 },{timeout:30000});
}
export async function runCommunications(database: PrismaClient, now=new Date()) {
 let created=0,queued=0;
 const settings=await database.communicationSettings.findMany({include:{organization:{select:{name:true}}}});
 for(const rule of settings) {
 const scope=tenantWhere(rule.organizationId), day=nairobiDay(now), dom=Number(day.slice(-2));
 if(rule.balanceEnabled && !rule.arrearsEnabled && [7,10].includes(dom)) {
 const charges=await database.charge.findMany({where:{organizationId:rule.organizationId,student:scope,dueDate:{lte:new Date(now.getTime()+3*86400000)},status:{in:["UNPAID","PARTIALLY_PAID","OVERDUE"]}},include:{student:{select:{paymentAgreedDate:true}},payments:{where:{reversedAt:null},select:{amount:true}}}});
 for(const charge of charges) {
 if(agreementActive(charge.student.paymentAgreedDate,now)) continue;
 const balance=outstanding(charge.amount.toString(),charge.payments,charge.currency); if(!balance) continue;
 const key=`balance:${charge.id}:${day}`;
 created+=await database.$transaction(tx=>addMessage(tx,{organizationId:rule.organizationId,studentId:charge.studentId,batchId:key,dedupKey:key,title:"Accommodation balance reminder",body:`Your outstanding balance for ${charge.description} is ${formatMoney(balance,charge.currency)}. Due date: ${charge.dueDate.toLocaleDateString("en-KE",{timeZone:"Africa/Nairobi"})}. Please pay by the agreed due date or contact management. View your statement in your tenant account.`,category:"BALANCE",publishAt:now,whatsappCopy:rule.whatsappCopies,emailCopy:rule.emailCopies}));
 }
 }
 if(rule.holidayEnabled) {
 const breaks=await database.breakPeriod.findMany({where:{organizationId:rule.organizationId,status:"UPCOMING",startDate:{gte:now,lte:new Date(now.getTime()+7*86400000)}}});
 if(breaks.length) {
 const students=await database.student.findMany({where:scope,select:{id:true}});
 for(const holiday of breaks) for(const student of students) {
 const key=`holiday:${holiday.id}`;
 created+=await database.$transaction(tx=>addMessage(tx,{organizationId:rule.organizationId,studentId:student.id,batchId:key,dedupKey:key,title:`Holiday arrangements: ${holiday.name}`,body:`${holiday.name} begins on ${holiday.startDate.toLocaleDateString("en-KE",{timeZone:"Africa/Nairobi"})}. Contact management to confirm whether you will return next semester, stay during the holiday or vacate. Confirm room retention, belongings and any applicable charges before leaving. Read the hostel terms in your account.`,category:"HOLIDAY",publishAt:now,whatsappCopy:rule.whatsappCopies,emailCopy:rule.emailCopies}));
 }
 }
 }
 }
 queued=await queueCommunicationCopies(database,now);
 return {created,queued};
}
export async function queueCommunicationCopies(database: PrismaClient, now=new Date(), scope?:{organizationId:string;batchId:string}) {
 let queued=0;
 // Copies are queued, never labelled delivered. Revalidate tenancy and channel at queue time.
 const pending=await database.tenantMessage.findMany({where:{...scope,category:{not:"ARREARS"},publishAt:{lte:now},notificationId:null,whatsappCopy:true},select:{id:true},take:500});
 for(const candidate of pending) await database.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "TenantMessage" WHERE id=${candidate.id} FOR UPDATE`;
 const item=await tx.tenantMessage.findUnique({where:{id:candidate.id}}); if(!item || item.notificationId) return;
 const [student,org]=await Promise.all([tx.student.findFirst({where:{...tenantWhere(item.organizationId),id:item.studentId},select:{id:true,fullName:true,phone:true}}),tx.organization.findUnique({where:{id:item.organizationId},select:{whatsappEnabled:true}})]);
 if(!student?.phone || !org?.whatsappEnabled) return;
 if(item.category === "BALANCE") {
   const { readArrears } = await import("./arrears-reminders");
   const current = await readArrears(tx,item.organizationId,now,[item.studentId]);
   if(!current.rows.length || current.review.length) { await tx.tenantMessage.update({where:{id:item.id},data:{whatsappCopy:false}}); return; }
 }
 const properties=await tx.property.findMany({where:{organizationId:item.organizationId,active:true,publicListing:true},select:{customDomain:true,publicListing:true}});
 const notification=await tx.notification.create({data:{organizationId:item.organizationId,studentId:student.id,channel:"WHATSAPP",recipientType:"STUDENT",recipientName:student.fullName,recipientPhone:student.phone,message:`${item.title}\n\n${item.body}\n\nYour account: ${propertyTenantLogin(properties)}`,status:"QUEUED",scheduledAt:now}});
 await tx.tenantMessage.update({where:{id:item.id},data:{notificationId:notification.id}});queued++;
 });
 return queued;
}
