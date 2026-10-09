import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { tenantWhere } from "@/lib/communications";
import { localSessionCurrent } from "@/lib/account-security-policy";
import { whatsappDraftId, whatsappLink, whatsappNumber } from "@/lib/whatsapp-policy";

type Database = Pick<PrismaClient, "organization" | "property" | "user">;
export type WhatsAppResult = { error?: string; success?: string; url?: string };
const schema = z.object({ requestId: z.string().uuid(), audience: z.enum(["TENANTS", "STAFF"]),
  selection: z.enum(["ALL", "SELECTED"]), recipientIds: z.array(z.string().min(1).max(128)).max(500),
  message: z.string().trim().min(3).max(3000) });

export async function messagingProperties(database: Pick<PrismaClient, "property">, organizationId: string) {
  return database.property.findMany({ where: { organizationId, active: true },
    select: { id: true, name: true, phone: true, countryCode: true, customDomain: true, publicListing: true }, orderBy: { name: "asc" } });
}
export function messagingCountry(properties: Array<{ countryCode: string | null }>, organizationId: string) {
  const countries = [...new Set(properties.map(p => p.countryCode).filter(Boolean))];
  return countries.length === 1 ? countries[0] : countries.length === 0 && organizationId === "mama-mbugua-hostel" ? "KE" : null;
}
export async function managementWhatsAppContacts(database: Database, organizationId: string, propertyIds?: string[]) {
  const [organization, allProperties] = await Promise.all([
    database.organization.findFirst({ where: { id: organizationId, status: "ACTIVE" }, select: { name: true, phone: true, whatsappEnabled: true } }),
    messagingProperties(database, organizationId),
  ]);
  if (!organization?.whatsappEnabled) return [];
  const properties = propertyIds ? allProperties.filter(p => propertyIds.includes(p.id)) : allProperties;
  const candidates = properties.length ? properties.map(p => ({ name: p.name, phone: p.phone || organization.phone, country: p.countryCode ?? messagingCountry(properties, organizationId) }))
    : [{ name: organization.name, phone: organization.phone, country: messagingCountry(allProperties, organizationId) }];
  const seen = new Set<string>();
  return candidates.flatMap(c => {
    const number = whatsappNumber(c.phone, c.country);
    if (!number || seen.has(number)) return [];
    seen.add(number); return [{ name: c.name, number, href: whatsappLink(number) }];
  });
}
async function lockedManager(tx: Prisma.TransactionClient, session: SessionPayload) {
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${session.userId} AND "organizationId"=${session.organizationId} FOR UPDATE`;
  const actor = await tx.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, active: true, role: { in: ["OWNER", "ADMIN", "MANAGER"] }, organization: { status: "ACTIVE" } }, select: { id: true, sessionVersion: true } });
  return actor && localSessionCurrent(session.sessionVersion, actor.sessionVersion) ? actor : null;
}
export async function prepareWhatsAppDrafts(database: PrismaClient, session: SessionPayload | null, input: unknown): Promise<WhatsAppResult> {
  if (!session) return { error: "Management sign-in is required." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Choose recipients and enter a message of 3–3,000 characters." };
  const value = parsed.data, ids = [...new Set(value.recipientIds)];
  if (value.selection === "SELECTED" && !ids.length) return { error: "Select at least one recipient." };
  return database.$transaction(async tx => {
    if (!await lockedManager(tx, session)) return { error: "Only active management can prepare messages." };
    const org = await tx.organization.findUniqueOrThrow({ where: { id: session.organizationId }, select: { name: true, whatsappEnabled: true } });
    if (!org.whatsappEnabled) return { error: "Enable WhatsApp in Settings first." };
    const properties = await messagingProperties(tx, session.organizationId), country = messagingCountry(properties, session.organizationId);
    const selected = value.selection === "SELECTED" ? { id: { in: ids } } : {};
    const recipients = value.audience === "TENANTS"
      ? (await tx.student.findMany({ where: { ...tenantWhere(session.organizationId), ...selected }, select: { id: true, fullName: true, phone: true, occupancies: { where: { organizationId: session.organizationId, status: { in: ["ACTIVE", "RESERVED"] } }, select: { room: { select: { propertyId: true } } }, orderBy: { createdAt: "desc" }, take: 1 } }, take: 501 })).map(s => ({ id: s.id, name: s.fullName, phone: s.phone, country: properties.find(p => p.id === s.occupancies[0]?.room.propertyId)?.countryCode ?? country }))
      : (await tx.user.findMany({ where: { organizationId: session.organizationId, active: true, ...selected }, select: { id: true, name: true, phone: true }, take: 501 })).map(u => ({ ...u, country }));
    if (!recipients.length || recipients.length > 500 || (value.selection === "SELECTED" && recipients.length !== ids.length)) return { error: "Choose current tenants or active staff from this hostel, up to 500 recipients." };
    const kind = value.audience === "TENANTS" ? "STUDENT" : "STAFF";
    const valid = recipients.map(r => ({ ...r, number: whatsappNumber(r.phone, r.country) }));
    const missing = valid.filter(r => !r.number).length;
    if (missing) return { error: `${missing} selected contact${missing === 1 ? " needs" : "s need"} a valid international phone number. Update the contact or choose fewer recipients. No drafts were created.` };
    const drafts = valid.map(r => ({ id: whatsappDraftId(session.organizationId, value.requestId, kind, r.id), organizationId: session.organizationId, createdById: session.userId,
      studentId: kind === "STUDENT" ? r.id : null, recipientStaffId: kind === "STAFF" ? r.id : null,
      channel: "WHATSAPP" as const, recipientType: kind as "STUDENT" | "STAFF", recipientName: r.name, recipientPhone: r.number!, message: `${org.name}\n\n${value.message}`, status: "QUEUED" as const }));
    const saved = await tx.notification.createMany({ data: drafts, skipDuplicates: true });
    if (saved.count) await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "WHATSAPP_DRAFTS_PREPARED", entityType: "Notification", entityId: value.requestId, metadata: { audience: value.audience, count: saved.count } } });
    return { success: saved.count ? `${saved.count} private WhatsApp draft${saved.count === 1 ? " is" : "s are"} ready. Open each draft and send it in WhatsApp.` : "These drafts are already saved. Check the list below." };
  }, { timeout: 15000 });
}

export async function actOnManualNotification(database: PrismaClient, session: SessionPayload | null, id: string, action: "OPEN" | "SENT" | "FAILED" | "CANCEL", reason = ""): Promise<WhatsAppResult> {
  if (!session || !id || id.length > 128) return { error: "Message unavailable." };
  return database.$transaction(async tx => {
    if (!await lockedManager(tx, session)) return { error: "Only active management can manage messages." };
    await tx.$queryRaw`SELECT id FROM "Notification" WHERE id=${id} AND "organizationId"=${session.organizationId} FOR UPDATE`;
    const item = await tx.notification.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!item || ["SENT", "CANCELLED"].includes(item.status) || item.scheduledAt > new Date()) return { error: "This message is unavailable, scheduled for later or already completed." };
    const org = await tx.organization.findUniqueOrThrow({ where: { id: session.organizationId }, select: { whatsappEnabled: true, smsEnabled: true } });
    if (action !== "CANCEL" && !(item.channel === "WHATSAPP" ? org.whatsappEnabled : org.smsEnabled)) return { error: "This channel is disabled in Settings." };
    if (action === "SENT" && item.status !== "OPENED_FOR_SENDING") return { error: "Open the draft and send it in WhatsApp or SMS before marking it sent." };
    let url: string | undefined;
    if (action === "OPEN") {
      const properties = await messagingProperties(tx, session.organizationId), country = messagingCountry(properties, session.organizationId);
      let phone: string | null | undefined, recipientCountry = country;
      if (item.recipientType === "STAFF") {
        phone = item.recipientStaffId ? (await tx.user.findFirst({ where: { id: item.recipientStaffId, organizationId: session.organizationId, active: true }, select: { phone: true } }))?.phone : null;
      } else if (item.studentId) {
        const student = await tx.student.findFirst({ where: { ...tenantWhere(session.organizationId), id: item.studentId }, select: { phone: true, guardian: { select: { phone: true } }, occupancies: { where: { organizationId: session.organizationId, status: { in: ["ACTIVE", "RESERVED"] } }, select: { room: { select: { propertyId: true } } }, orderBy: { createdAt: "desc" }, take: 1 } } });
        phone = item.recipientType === "GUARDIAN" ? student?.guardian?.phone : student?.phone;
        recipientCountry = properties.find(p => p.id === student?.occupancies[0]?.room.propertyId)?.countryCode ?? country;
      }
      const number = whatsappNumber(phone, recipientCountry), recorded = whatsappNumber(item.recipientPhone, recipientCountry);
      if (!number || number !== recorded) {
        await tx.notification.update({ where: { id }, data: { status: "FAILED", failureReason: "Recipient access or contact changed. Prepare a new draft after checking the contact." } });
        return { error: "Recipient access or phone number changed. Prepare a new draft." };
      }
      url = item.channel === "WHATSAPP" ? whatsappLink(number, item.message) : `sms:+${number}?body=${encodeURIComponent(item.message)}`;
    }
    const data = action === "OPEN" ? { status: "OPENED_FOR_SENDING" as const, openedAt: new Date(), failureReason: null }
      : action === "SENT" ? { status: "SENT" as const, sentAt: new Date(), failureReason: null }
      : action === "FAILED" ? { status: "FAILED" as const, failureReason: reason.trim().slice(0, 300) || "Management reported that the message was not sent." }
      : { status: "CANCELLED" as const };
    await tx.notification.update({ where: { id }, data });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: `MANUAL_MESSAGE_${action}`, entityType: "Notification", entityId: id } });
    return { success: action === "SENT" ? "Marked sent manually. WhatsApp delivery is not verified by this system." : "Message updated.", ...(url ? { url } : {}) };
  });
}

