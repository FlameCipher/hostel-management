import type { PrismaClient } from "@/generated/prisma/client";
import { whatsappNumber } from "./whatsapp-policy";
import { whatsappMessageState } from "./message-delivery-policy";
export async function readMessageDelivery(database: PrismaClient, organizationId: string, reportId: string) {
  if (!reportId || reportId.length > 128) return null;
  const audit = await database.auditLog.findFirst({where:{organizationId,entityId:reportId,action:"ARREARS_REQUESTS_CREATED"},orderBy:{createdAt:"desc"},select:{metadata:true}});
  const metadata = audit?.metadata as {messageIds?:unknown} | null;
  const ids = Array.isArray(metadata?.messageIds) ? metadata.messageIds.filter((id):id is string=>typeof id==="string").slice(0,500) : null;
  const messages = await database.tenantMessage.findMany({where:{organizationId,...(ids ? {id:{in:ids}} : {batchId:reportId})},include:{student:{select:{fullName:true,phone:true,email:true,portalEnabled:true,portalPasswordHash:true}}},orderBy:{student:{fullName:"asc"}},take:5000});
  if (!messages.length) return null;
  const notificationIds = messages.flatMap(m=>m.notificationId?[m.notificationId]:[]);
  const [org,connection,notifications,deliveries,consents,properties] = await Promise.all([
    database.organization.findUnique({where:{id:organizationId},select:{whatsappEnabled:true}}),
    database.whatsAppConnection.findUnique({where:{organizationId},select:{enabled:true,verifiedAt:true}}),
    database.notification.findMany({where:{organizationId,id:{in:notificationIds}},select:{id:true,status:true,createdAt:true,message:true,recipientName:true,recipientPhone:true,recipientType:true}}),
    database.whatsAppDelivery.findMany({where:{organizationId,notificationId:{in:notificationIds}},select:{notificationId:true,status:true}}),
    database.whatsAppConsent.findMany({where:{organizationId,audience:"tenant",enabled:true,accountId:{in:messages.map(m=>m.studentId)}},select:{accountId:true,phone:true,updatedAt:true}}),
    database.property.findMany({where:{organizationId,active:true},select:{countryCode:true}}),
  ]);
  const countryCodes=[...new Set(properties.map(p=>p.countryCode).filter(Boolean))];
  const countryCode=countryCodes.length===1?countryCodes[0]:organizationId==="mama-mbugua-hostel"?"KE":null;
  const ready = !!(org?.whatsappEnabled && connection?.enabled && connection.verifiedAt && process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && process.env.SERVICE_ENCRYPTION_KEY);
  const rows = messages.map(m=>{
    const n=notifications.find(n=>n.id===m.notificationId), d=deliveries.find(d=>d.notificationId===m.notificationId), c=consents.find(c=>c.accountId===m.studentId);
    const phone=whatsappNumber(n?.recipientType==="GUARDIAN"?n.recipientPhone:m.student.phone,countryCode);
    let whatsapp=whatsappMessageState({requested:m.whatsappCopy,needsNewDraft:m.category==="ARREARS"&&!n&&m.whatsappCopy,provider:d?.status,manual:n?.status,ready,phone:!!phone,consent:!!(c && c.phone===phone && c.updatedAt <= (n?.createdAt??m.createdAt)),predatesConnection:!!(connection?.verifiedAt && (n?.createdAt??m.createdAt)<connection.verifiedAt),tooLong:(n?.message.length??m.body.length)>1000});
    if(n?.recipientType==="GUARDIAN" && !d && !["SENT","OPENED_FOR_SENDING","CANCELLED","FAILED"].includes(n.status)) whatsapp={label:"Not sent — open the sponsor/guardian’s WhatsApp and tap Send",sent:false,delivered:false,queued:false,attention:true};
    const portalReady=m.student.portalEnabled && m.student.portalPasswordHash!==null;
    return {id:m.id,name:m.student.fullName,recipient:n?`${n.recipientName} (+${n.recipientPhone})`:m.student.fullName,notificationId:n?.id??null,canOpen:!!n&&["QUEUED","OPENED_FOR_SENDING","FAILED"].includes(n.status)&&!d,whatsapp,email:!m.emailCopy?"Not requested":m.emailStatus==="SENT"?"Accepted by email provider; delivery unconfirmed":!m.student.email?"Not sent — no email address":m.emailStatus.replaceAll("_"," "),portal:m.readAt?"Read in student inbox":!portalReady?"Saved — student account not activated":m.publishAt>new Date()?"Scheduled":"Available in student inbox"};
  });
  return {reportId,total:rows.length,sent:rows.filter(r=>r.whatsapp.sent).length,delivered:rows.filter(r=>r.whatsapp.delivered).length,queued:rows.filter(r=>r.whatsapp.queued).length,attention:rows.filter(r=>r.whatsapp.attention).length,ready,rows};
}
export type MessageDeliveryReport = NonNullable<Awaited<ReturnType<typeof readMessageDelivery>>>;
