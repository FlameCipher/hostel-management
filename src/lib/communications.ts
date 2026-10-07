import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";

export const communicationSchema = z.object({
 title: z.string().trim().min(3).max(160), body: z.string().trim().min(10).max(3000),
 audience: z.enum(["ALL", "SELECTED"]), studentIds: z.array(z.string().min(1).max(128)).max(5000),
 category: z.enum(["GENERAL", "EXAM", "HOLIDAY", "BALANCE"]),
 publishAt: z.date(), email: z.boolean().default(false), whatsapp: z.boolean(), requestId: z.string().uuid(),
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
export function outstanding(amount: string | number, payments: Array<{ amount: { toString(): string } }>) {
 const cents = (value: string) => Math.round(Number(value)*100);
 return Math.max(0, cents(String(amount)) - payments.reduce((sum,p) => sum+cents(p.amount.toString()),0))/100;
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
 if(value.audience === "SELECTED" && !value.studentIds.length) return { error: "Select at least one tenant." };
 return database.$transaction(async tx => {
 const org=await tx.organization.findUnique({where:{id:session.organizationId},select:{whatsappEnabled:true}});
 if(value.whatsapp && !org?.whatsappEnabled) return {error:"Enable WhatsApp in Settings first."};
 const ids=[...new Set(value.studentIds)];
 const students=await tx.student.findMany({where:{...tenantWhere(session.organizationId), ...(value.audience === "SELECTED" ? {id:{in:ids}} : {})},select:{id:true},take:5001});
 if(!students.length || students.length>5000 || (value.audience === "SELECTED" && students.length !== ids.length)) return {error:"Recipients must be current tenants of this hostel. Maximum 5,000 recipients."};
 let added=0;
 for(const student of students) added+=await addMessage(tx,{organizationId:session.organizationId,studentId:student.id,batchId:value.requestId,dedupKey:value.requestId,title:value.title,body:value.body,category:value.category,publishAt:value.publishAt,whatsappCopy:value.whatsapp,emailCopy:value.email});
 if(added) await tx.auditLog.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"TENANT_COMMUNICATION_PUBLISHED",entityType:"TenantMessage",entityId:value.requestId,metadata:{recipients:added,audience:value.audience,publishAt:value.publishAt.toISOString()}}});
 return {success:`Saved for ${students.length} tenant${students.length===1?"":"s"}. ${value.publishAt > new Date() ? "Scheduled for publication." : "Available in their private inboxes."}`};
 },{timeout:30000});
}
export async function runCommunications(database: PrismaClient, now=new Date()) {
 let created=0,queued=0;
 const settings=await database.communicationSettings.findMany({include:{organization:{select:{name:true}}}});
 for(const rule of settings) {
 const scope=tenantWhere(rule.organizationId), day=nairobiDay(now), dom=Number(day.slice(-2));
 if(rule.balanceEnabled && [7,10].includes(dom)) {
 const charges=await database.charge.findMany({where:{organizationId:rule.organizationId,student:scope,dueDate:{lte:new Date(now.getTime()+3*86400000)},status:{in:["UNPAID","PARTIALLY_PAID","OVERDUE"]}},include:{payments:{where:{reversedAt:null},select:{amount:true}}}});
 for(const charge of charges) {
 const balance=outstanding(charge.amount.toString(),charge.payments); if(!balance) continue;
 const key=`balance:${charge.id}:${day}`;
 created+=await database.$transaction(tx=>addMessage(tx,{organizationId:rule.organizationId,studentId:charge.studentId,batchId:key,dedupKey:key,title:"Accommodation balance reminder",body:`Your outstanding balance for ${charge.description} is KES ${balance.toLocaleString("en-KE",{minimumFractionDigits:2})}. Due date: ${charge.dueDate.toLocaleDateString("en-KE",{timeZone:"Africa/Nairobi"})}. Please clear rent arrears by the 10th or contact management. View your statement in your tenant account.`,category:"BALANCE",publishAt:now,whatsappCopy:rule.whatsappCopies,emailCopy:rule.emailCopies}));
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
 // Copies are queued, never labelled delivered. Revalidate tenancy and channel at queue time.
 const pending=await database.tenantMessage.findMany({where:{publishAt:{lte:now},notificationId:null,whatsappCopy:true},select:{id:true},take:500});
 for(const candidate of pending) await database.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "TenantMessage" WHERE id=${candidate.id} FOR UPDATE`;
 const item=await tx.tenantMessage.findUnique({where:{id:candidate.id}}); if(!item || item.notificationId) return;
 const [student,org]=await Promise.all([tx.student.findFirst({where:{...tenantWhere(item.organizationId),id:item.studentId},select:{id:true,fullName:true,phone:true}}),tx.organization.findUnique({where:{id:item.organizationId},select:{whatsappEnabled:true}})]);
 if(!student?.phone || !org?.whatsappEnabled) return;
 const notification=await tx.notification.create({data:{organizationId:item.organizationId,studentId:student.id,channel:"WHATSAPP",recipientType:"STUDENT",recipientName:student.fullName,recipientPhone:student.phone,message:`${item.title}\n\n${item.body}\n\nYour account: https://hostel.sampesa.com/tenant/login`,status:"QUEUED",scheduledAt:now}});
 await tx.tenantMessage.update({where:{id:item.id},data:{notificationId:notification.id}});queued++;
 });
 return {created,queued};
}
