import { hash } from "bcryptjs";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "./auth/session";
import { verifyBookingTicket } from "./booking-requests";
import { publishedWhere } from "./property-host-policy";
import { residentStaff } from "./resident-access";
import { whatsappNumber } from "./whatsapp-policy";
import { normalizedResidentName } from "./resident-policy";
const schema = z.object({ fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(8).max(30), roomNumber: z.string().trim().min(1).max(40), password: z.string().min(10).max(128).refine(v => Buffer.byteLength(v, "utf8") <= 72), confirmation: z.string().max(128), consent: z.literal(true) }).refine(v => v.password === v.confirmation);
export async function submitTenantRegistration(db: PrismaClient, propertyId: string, raw: unknown, ticket: unknown, fingerprint: string, now = new Date()): Promise<{ error?: string; success?: string }> {
  const parsed = schema.safeParse(raw), signed = verifyBookingTicket(ticket, `registration:${propertyId}`, now);
  if (!parsed.success || !signed || !fingerprint) return { error: "Complete your details and matching passwords (10 characters minimum, up to 72 UTF-8 bytes). Refresh this page if it has expired." };
  const property = await db.property.findFirst({ where: { id: propertyId, ...publishedWhere() } });
  if (!property) return { error: "Open your hostel website to register." };
  const phone = whatsappNumber(parsed.data.phone, property.countryCode);
  if (!phone) return { error: "Use your registered phone number with country code, for example +254…" };
  if (await db.tenantRegistration.count({ where: { fingerprint, createdAt: { gte: new Date(now.getTime() - 3600000) } } }) >= 5) return { error: "Too many requests. Please wait an hour or contact management." };
  const passwordHash = await hash(parsed.data.password, 12);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${propertyId} FOR UPDATE`;
    if (!await tx.property.findFirst({ where: { id: propertyId, ...publishedWhere() }, select: { id: true } })) return { error: "Registration unavailable for this hostel." };
    const success = "Request saved for management verification. No account access is granted until your identity and existing room allocation are verified. Contact the hostel office, then sign in using your phone and chosen password once approved.";
    if (await tx.tenantRegistration.findUnique({ where: { propertyId_requestId: { propertyId, requestId: signed.requestId } } })) return { success };
    const recent = { gte: new Date(now.getTime() - 3600000) };
    if (await tx.tenantRegistration.count({ where: { propertyId, createdAt: recent } }) >= 100 || await tx.tenantRegistration.count({ where: { fingerprint, createdAt: recent } }) >= 5 || await tx.tenantRegistration.count({ where: { propertyId, phone, createdAt: recent } }) >= 3) return { error: "Too many recent registration requests. Contact management or try later." };
    await tx.tenantRegistration.create({ data: { organizationId: property.organizationId, propertyId, requestId: signed.requestId, fullName: parsed.data.fullName, phone, roomNumber: parsed.data.roomNumber, passwordHash, fingerprint, expiresAt: new Date(now.getTime() + 7 * 86400000) } });
    return { success };
  });
}
export async function reviewTenantRegistration(db: PrismaClient, session: SessionPayload | null, raw: unknown, now = new Date()): Promise<{ error?: string; success?: string }> {
  const parsed = z.object({ id: z.string().min(1).max(128), studentId: z.string().max(128), approve: z.boolean(), verified: z.boolean() }).safeParse(raw);
  if (!session || !parsed.success) return { error: "Registration unavailable." };
  const input = parsed.data;
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${session.userId} AND "organizationId"=${session.organizationId} FOR SHARE`;
    if (!await residentStaff(tx, session, true)) return { error: "Only management may verify tenant registration." };
    // Consistent student-before-request lock order also protects invitation activation.
    if (input.studentId) await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${input.studentId} AND "organizationId"=${session.organizationId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "TenantRegistration" WHERE id=${input.id} AND "organizationId"=${session.organizationId} FOR UPDATE`;
    const row = await tx.tenantRegistration.findFirst({ where: { id: input.id, organizationId: session.organizationId, status: "PENDING" }, include: { property: true } });
    if (!row) return { error: "This request is unavailable or already reviewed." };
    if (row.expiresAt <= now) {
      await tx.tenantRegistration.update({ where: { id: row.id }, data: { status: "EXPIRED", passwordHash: null, reviewedAt: now, reviewedById: session.userId } });
      return { error: "This request expired. Ask the tenant to submit a new one." };
    }
    if (input.approve) {
      if (!input.verified || !input.studentId || !row.passwordHash) return { error: "Select the existing tenant and confirm that you independently verified their identity in person or through the contact already on file." };
      const student = await tx.student.findFirst({ where: { id: input.studentId, organizationId: session.organizationId, status: "ACTIVE", portalEnabled: false, portalPasswordHash: null, portalLastLoginAt: null, portalInviteBlocked: false, occupancies: { some: { organizationId: session.organizationId, status: "ACTIVE", room: { organizationId: session.organizationId, propertyId: row.propertyId, number: { equals: row.roomNumber, mode: "insensitive" } }, semester: { organizationId: session.organizationId } } } } });
      if (!student || !row.property.active || whatsappNumber(student.phone, row.property.countryCode) !== row.phone || normalizedResidentName(student.fullName) !== normalizedResidentName(row.fullName)) return { error: "The name, registered phone and current room must match this hostel's existing tenant record. Existing, disabled or previously used portal accounts require the account recovery process." };
      await tx.student.update({ where: { id: student.id }, data: { portalEnabled: true, portalPasswordHash: row.passwordHash } });
      await tx.tenantPortalInvitation.updateMany({ where: { organizationId: session.organizationId, studentId: student.id, usedAt: null }, data: { tokenHash: null, status: "ACTIVATED", usedAt: now } });
    }
    await tx.tenantRegistration.update({ where: { id: row.id }, data: { status: input.approve ? "APPROVED" : "REJECTED", studentId: input.approve ? input.studentId : null, passwordHash: null, reviewedById: session.userId, reviewedAt: now } });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: input.approve ? "TENANT_REGISTRATION_APPROVED" : "TENANT_REGISTRATION_REJECTED", entityType: "TenantRegistration", entityId: row.id, metadata: { ...(input.approve ? { studentId: input.studentId } : {}), identityVerified: input.verified } } });
    return { success: input.approve ? "Existing tenant account activated. The tenant can sign in with their registered phone and chosen password." : "Registration request rejected." };
  });
}
