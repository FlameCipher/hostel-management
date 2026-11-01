import { agreementActive } from "./payment-agreement-policy";
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient, TenantMessage, Notification } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { z } from "zod";
import { tenantWhere } from "@/lib/communications";
import { localSessionCurrent } from "@/lib/account-security-policy";
import { hostelTimeZone } from "@/lib/resident-policy";
import { whatsappNumber, propertyTenantLogin } from "@/lib/whatsapp-policy";
import { arrearsCooldown, arrearsFingerprint, arrearsMessage, arrearsPosition, ARREARS_INTERVAL_DAYS } from "@/lib/arrears-policy";
import { formatMoney } from "@/lib/currency";

type Reader = Pick<Prisma.TransactionClient, "organization" | "student" | "property" | "tenantMessage">;
export async function readArrears(database: Reader, organizationId: string, now = new Date(), ids?: string[]) {
  const [org, properties, students] = await Promise.all([
    database.organization.findFirst({ where: { id: organizationId, status: "ACTIVE" }, select: { id: true, name: true, currency: true, whatsappEnabled: true } }),
    database.property.findMany({ where: { organizationId, active: true }, select: { id: true, customDomain: true, publicListing: true, timeZone: true, countryCode: true } }),
    database.student.findMany({ where: { ...tenantWhere(organizationId), ...(ids ? { id: { in: ids } } : {}) }, select: {
      id: true, fullName: true, phone: true, email: true, portalEnabled: true, portalPasswordHash: true, paymentAgreedDate: true, paymentAgreementNote: true,
      occupancies: { where: { organizationId, status: { in: ["ACTIVE", "RESERVED"] } }, select: { room: { select: { number: true, propertyId: true } } }, orderBy: { createdAt: "desc" }, take: 1 },
      charges: { where: { organizationId, status: { not: "WAIVED" } }, select: { id: true, organizationId: true, studentId: true, currency: true, amount: true, dueDate: true, status: true, payments: { where: { reversedAt: null }, select: { amount: true, organizationId: true, studentId: true, currency: true, reversedAt: true } } } },
    }, orderBy: { fullName: "asc" }, take: 5001 }),
  ]);
  if (!org) throw Error("Hostel account unavailable.");
  if (students.length > 5000) throw Error("This register is too large. Select a smaller group of tenants.");
  const history = await database.tenantMessage.findMany({ where: { organizationId, category: "ARREARS", studentId: { in: students.map(s => s.id) } }, distinct: ["studentId"], orderBy: { createdAt: "desc" }, select: { id: true, studentId: true, createdAt: true, emailStatus: true, notificationId: true, readAt: true } });
  const lastByStudent = new Map(history.map(h => [h.studentId, h]));
  const review: { studentId: string; name: string; reason: string }[] = [];
  const deferred: { studentId: string; name: string; room: string; balance: string; agreedDate: string; note: string }[] = [];
  const rows = students.flatMap(student => {
    const occupancy = student.occupancies[0], property = properties.find(p => p.id === occupancy?.room.propertyId);
    const timeZone = hostelTimeZone(property?.timeZone, property?.countryCode ?? "");
    const position = arrearsPosition(student.charges, organizationId, student.id, org.currency, now, timeZone);
    if (position.error) { review.push({ studentId: student.id, name: student.fullName, reason: position.error }); return []; }
    if (!position.balance || !position.oldest) return [];
    if (agreementActive(student.paymentAgreedDate, now, timeZone)) {
      deferred.push({ studentId: student.id, name: student.fullName, room: occupancy?.room.number ?? "", balance: formatMoney(position.balance, org.currency), agreedDate: student.paymentAgreedDate!.toISOString().slice(0, 10), note: student.paymentAgreementNote ?? "" });
      return [];
    }
    const due = position.oldest.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone });
    const phone = whatsappNumber(student.phone, property?.countryCode ?? (organizationId === "mama-mbugua-hostel" ? "KE" : null)) ?? "";
    const email = z.string().email().safeParse(student.email).success ? student.email! : "";
    const room = occupancy?.room.number ?? "", login = propertyTenantLogin(property ? [property] : properties);
    const last = lastByStudent.get(student.id);
    return [{ studentId: student.id, name: student.fullName, room, phone, email, amount: position.balance, balance: formatMoney(position.balance, org.currency), due,
      portalReady: student.portalEnabled && student.portalPasswordHash !== null,
      fingerprint: arrearsFingerprint({ studentId: student.id, amount: position.balance, currency: org.currency, due, phone, email, name: student.fullName, room }),
      message: arrearsMessage({ hostel: org.name, name: student.fullName, amount: position.balance, currency: org.currency, due, login }),
      lastAt: last?.createdAt.toISOString() ?? null, lastNotificationId: last?.notificationId ?? null, lastRead: !!last?.readAt, lastEmailStatus: last?.emailStatus ?? null }];
  });
  return { org, rows, review, deferred };
}
export type ArrearsRow = Awaited<ReturnType<typeof readArrears>>["rows"][number];
export type ArrearsResult = { error?: string; success?: string; notificationId?: string };
const requestSchema = z.object({ requestId: z.string().uuid(), recipients: z.array(z.object({ studentId: z.string().min(1).max(128), fingerprint: z.string().length(64) })).min(1).max(500), whatsapp: z.boolean(), email: z.boolean(), manual: z.boolean().default(false) });

async function saveNotice(tx: Prisma.TransactionClient, organizationId: string, row: ArrearsRow, options: { key: string; whatsapp: boolean; email: boolean; actor?: string }, now: Date) {
  const messageId = randomUUID(), notificationId = options.whatsapp && row.phone ? `arrears_${messageId}` : null;
  const data = { id: messageId, organizationId, studentId: row.studentId, batchId: options.key, dedupKey: options.key, category: "ARREARS", title: "Formal demand for overdue rent", body: row.message, publishAt: now, createdAt: now,
    whatsappCopy: !!notificationId, notificationId, emailCopy: options.email, emailStatus: options.email ? "QUEUED" : "NOT_REQUESTED" };
  const saved = await tx.tenantMessage.createMany({ data, skipDuplicates: true });
  if (!saved.count) {
    const existing = await tx.tenantMessage.findUnique({ where: { organizationId_studentId_dedupKey: { organizationId, studentId: row.studentId, dedupKey: options.key } } });
    if (!existing) return null;
    const existingNotificationId = existing.notificationId ?? (options.whatsapp && row.phone ? `arrears_${existing.id}` : null);
    if (existingNotificationId && !existing.notificationId) {
      await tx.notification.create({ data: { id: existingNotificationId, organizationId, studentId: row.studentId, createdById: options.actor, recipientType: "STUDENT", channel: "WHATSAPP", recipientName: row.name, recipientPhone: row.phone, message: row.message, scheduledAt: now } });
      await tx.tenantMessage.update({ where: { id: existing.id }, data: { notificationId: existingNotificationId, whatsappCopy: true } });
    }
    if (options.email && !existing.emailCopy) await tx.tenantMessage.update({ where: { id: existing.id }, data: { emailCopy: true, emailStatus: "QUEUED" } });
    return { notificationId: existingNotificationId, duplicate: true };
  }
  if (notificationId) await tx.notification.create({ data: { id: notificationId, organizationId, studentId: row.studentId, createdById: options.actor, recipientType: "STUDENT", channel: "WHATSAPP", recipientName: row.name, recipientPhone: row.phone, message: row.message, scheduledAt: now } });
  return { notificationId, duplicate: false };
}
async function manager(tx: Prisma.TransactionClient, session: SessionPayload) {
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR UPDATE`;
  const actor = await tx.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, active: true, role: { in: ["OWNER", "ADMIN", "MANAGER"] }, organization: { status: "ACTIVE" } }, select: { sessionVersion: true } });
  return actor && localSessionCurrent(session.sessionVersion, actor.sessionVersion);
}
export async function requestArrears(database: PrismaClient, session: SessionPayload | null, input: unknown, now = new Date()): Promise<ArrearsResult> {
  if (!session) return { error: "Management sign-in is required." };
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { error: "Select up to 500 tenants and review their payment requests." };
  const value = parsed.data, ids = [...new Set(value.recipients.map(r => r.studentId))];
  if (ids.length !== value.recipients.length || (value.manual && ids.length !== 1)) return { error: "Select each tenant once." };
  return database.$transaction(async tx => {
    if (!await manager(tx, session)) return { error: "Only active management can send payment requests." };
    const current = await readArrears(tx, session.organizationId, now, ids);
    if (current.rows.length !== ids.length || current.review.length || current.rows.some(row => value.recipients.find(r => r.studentId === row.studentId)?.fingerprint !== row.fingerprint)) return { error: "A balance, contact or tenancy changed. Refresh the list and review the current amounts before sending." };
    if (value.whatsapp && !current.org.whatsappEnabled) return { error: "WhatsApp is disabled in hostel settings." };
    if (value.manual && !current.rows[0].phone) return { error: "Add a valid registered tenant phone number first." };
    const day = now.toISOString().slice(0, 10), key = `arrears:${day}`;
    let saved = 0, skipped = 0, notificationId: string | undefined;
    for (const row of current.rows) {
      if (value.manual && row.lastNotificationId && row.lastAt && row.lastAt.slice(0, 10) === day) { notificationId = row.lastNotificationId; continue; }
      const result = await saveNotice(tx, session.organizationId, row, { key, whatsapp: value.whatsapp, email: value.email, actor: session.userId }, now);
      if (result) { if (result.duplicate) skipped++; else saved++; notificationId = result.notificationId ?? undefined; } else skipped++;
    }
    if (saved) await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "ARREARS_REQUESTS_CREATED", entityType: "TenantMessage", entityId: value.requestId, metadata: { count: saved, whatsapp: value.whatsapp, email: value.email } } });
    return { success: `${saved} private payment request${saved === 1 ? "" : "s"} saved.${skipped ? ` ${skipped} already requested today.` : ""}${value.whatsapp ? " WhatsApp copies are queued where a valid phone is registered; open drafts that need manual sending." : ""}${value.email ? " Email copies are queued; missing addresses are shown in delivery history." : ""} Saving a notice does not confirm delivery.`, notificationId: value.manual ? notificationId : undefined };
  }, { timeout: 30000 });
}
export async function setArrearsAutomation(database: PrismaClient, session: SessionPayload | null, input: { enabled: boolean; whatsapp: boolean; email: boolean }): Promise<ArrearsResult> {
  if (!session) return { error: "Management sign-in is required." };
  return database.$transaction(async tx => {
    if (!await manager(tx, session)) return { error: "Only active management can change reminders." };
    const data = { arrearsEnabled: input.enabled, arrearsWhatsappCopies: input.whatsapp, arrearsEmailCopies: input.email };
    await tx.communicationSettings.upsert({ where: { organizationId: session.organizationId }, create: { organizationId: session.organizationId, ...data }, update: data });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "ARREARS_AUTOMATION_UPDATED", entityType: "Organization", entityId: session.organizationId, metadata: data } });
    return { success: input.enabled ? "Automatic overdue requests are on. Checked daily at 8 a.m. Nairobi time, at most once every 7 days per tenant while overdue." : "Automatic overdue requests are off." };
  });
}
export async function runArrearsAutomation(database: PrismaClient, now = new Date()) {
  const settings = await database.communicationSettings.findMany({ where: { arrearsEnabled: true, organization: { status: "ACTIVE" } } });
  let created = 0, skipped = 0;
  for (const setting of settings) await database.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${setting.organizationId} FOR UPDATE`;
    const currentSetting = await tx.communicationSettings.findUnique({ where: { organizationId: setting.organizationId } });
    if (!currentSetting?.arrearsEnabled) return;
    const current = await readArrears(tx, setting.organizationId, now);
    for (const row of current.rows) {
      if (arrearsCooldown(row.lastAt ? new Date(row.lastAt) : null, now, ARREARS_INTERVAL_DAYS)) { skipped++; continue; }
      const result = await saveNotice(tx, setting.organizationId, row, { key: `arrears:${now.toISOString().slice(0, 10)}`, whatsapp: currentSetting.arrearsWhatsappCopies && current.org.whatsappEnabled, email: currentSetting.arrearsEmailCopies }, now);
      if (result && !result.duplicate) created++;
    }
    if (current.rows.length) await tx.auditLog.create({ data: { organizationId: setting.organizationId, action: "ARREARS_AUTOMATION_CHECKED", entityType: "Organization", entityId: setting.organizationId, metadata: { eligible: current.rows.length, needsReview: current.review.length, intervalDays: ARREARS_INTERVAL_DAYS } } });
  }, { timeout: 30000 });
  return { created, skipped };
}

// Refresh only this feature's drafts. Historical notices and unrelated messages are untouched.
export async function freshArrearsBody(tx: Prisma.TransactionClient, item: Pick<TenantMessage, "id" | "category" | "organizationId" | "studentId" | "createdAt">, now = new Date()) {
  if (now.getTime() - item.createdAt.getTime() >= ARREARS_INTERVAL_DAYS * 86400000) return null;
  const current = await readArrears(tx, item.organizationId, now, [item.studentId]);
  const row = current.rows[0];
  if (!row || current.review.length) return null;
  return row.message;
}
export async function refreshArrearsNotification(tx: Prisma.TransactionClient, item: Notification, now = new Date()): Promise<Notification | null> {
  if (!item.id.startsWith("arrears_")) {
    const legacy = item.studentId ? await tx.tenantMessage.findFirst({ where: { organizationId: item.organizationId, studentId: item.studentId, notificationId: item.id, category: "BALANCE" } }) : null;
    if (!legacy) return item;
    const current = await readArrears(tx, item.organizationId, now, [legacy.studentId]);
    if (current.rows.length && !current.review.length) return item;
    await tx.notification.update({ where: { id: item.id }, data: { status: "CANCELLED", failureReason: "No eligible overdue balance, or an approved payment date applies." } });
    return null;
  }
  const notice = await tx.tenantMessage.findFirst({ where: { organizationId: item.organizationId, studentId: item.studentId ?? "", notificationId: item.id, category: "ARREARS" } });
  const body = notice ? await freshArrearsBody(tx, notice, now) : null;
  if (!body) { await tx.notification.update({ where: { id: item.id }, data: { status: "CANCELLED", failureReason: "No eligible overdue balance remains, or the account needs review." } }); return null; }
  return tx.notification.update({ where: { id: item.id }, data: { message: body } });
}
