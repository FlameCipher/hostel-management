import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantSession } from "./auth/tenant-session";
import type { SessionPayload } from "./auth/session";
import { residentStaff, residentTenant } from "./resident-access";
import { hostelTimeZone, visitLocalTime, visitTransition } from "./resident-policy";
import { whatsappNumber } from "./whatsapp-policy";
const schema = z.object({ requestId: z.uuid(), occupancyId: z.string().min(1).max(128), visitorName: z.string().trim().min(2).max(120), visitorPhone: z.string().trim().min(8).max(30), purpose: z.string().trim().min(2).max(200), vehicle: z.string().trim().max(30), arrival: z.string().max(20), departure: z.string().max(20) });
export async function requestVisit(db: PrismaClient, session: TenantSession | null, raw: unknown, now = new Date()): Promise<{ error?: string; success?: string }> {
  const parsed = schema.safeParse(raw);
  if (!session || !parsed.success) return { error: "Complete the visitor details, arrival and departure times." };
  const input = parsed.data;
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${session.studentId} AND "organizationId"=${session.organizationId} FOR UPDATE`;
    if (!await residentTenant(tx, session)) return { error: "Visitor requests require a current resident account." };
    const prior = await tx.visitorRequest.findUnique({ where: { organizationId_studentId_requestId: { organizationId: session.organizationId, studentId: session.studentId, requestId: input.requestId } } });
    if (prior) return { success: "Your visitor request is already saved." };
    const occupancy = await tx.occupancy.findFirst({ where: { id: input.occupancyId, studentId: session.studentId, organizationId: session.organizationId, status: "ACTIVE", room: { organizationId: session.organizationId, property: { organizationId: session.organizationId, active: true } }, semester: { organizationId: session.organizationId } }, include: { room: { include: { property: true } } } });
    if (!occupancy) return { error: "Choose your current room. Refresh if your allocation changed." };
    const property = occupancy.room.property, timeZone = hostelTimeZone(property.timeZone, property.countryCode);
    const arrival = visitLocalTime(input.arrival, timeZone), departure = visitLocalTime(input.departure, timeZone);
    if (!arrival || !departure || arrival.getTime() < now.getTime() - 15 * 60000 || arrival.getTime() > now.getTime() + 90 * 86400000 || departure <= arrival || departure.getTime() - arrival.getTime() > 7 * 86400000) return { error: "Choose valid hostel-local times: arrival within 90 days and departure within 7 days of arrival. Ambiguous daylight-saving times are not accepted." };
    const phone = whatsappNumber(input.visitorPhone, property.countryCode);
    if (!phone) return { error: "Enter the visitor phone with its country code, for example +254…" };
    if (await tx.visitorRequest.count({ where: { organizationId: session.organizationId, studentId: session.studentId, createdAt: { gte: new Date(now.getTime() - 86400000) } } }) >= 20) return { error: "Daily visitor request limit reached. Contact management." };
    const visit = await tx.visitorRequest.create({ data: { organizationId: session.organizationId, propertyId: property.id, studentId: session.studentId, occupancyId: occupancy.id, requestId: input.requestId, visitorName: input.visitorName, visitorPhone: phone, purpose: input.purpose, vehicle: input.vehicle || null, roomLabel: occupancy.room.number, timeZone, expectedArrival: arrival, expectedDeparture: departure } });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, action: "VISITOR_REQUESTED", entityType: "VisitorRequest", entityId: visit.id, metadata: { studentId: session.studentId } } });
    return { success: "Visitor request saved. Caretaker/security must verify arrival and departure at the gate." };
  });
}
export async function updateVisit(db: PrismaClient, session: SessionPayload | TenantSession | null, raw: unknown, tenant = false, now = new Date()): Promise<{ error?: string; success?: string }> {
  const parsed = z.object({ id: z.string().min(1).max(128), action: z.enum(["APPROVE", "DENY", "CHECK_IN", "CHECK_OUT", "CANCEL"]), verified: z.boolean(), note: z.string().trim().max(300) }).safeParse(raw);
  if (!session || !parsed.success) return { error: "Visitor action unavailable." };
  const input = parsed.data;
  if (tenant && input.action !== "CANCEL") return { error: "Only caretaker/security or management may verify visits." };
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR SHARE`;
    if (tenant) {
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${(session as TenantSession).studentId} AND "organizationId"=${session.organizationId} FOR UPDATE`;
      if (!await residentTenant(tx, session as TenantSession)) return { error: "Your resident access has changed." };
    } else {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${(session as SessionPayload).userId} AND "organizationId"=${session.organizationId} FOR SHARE`;
      if (!await residentStaff(tx, session as SessionPayload)) return { error: "Your staff access has changed." };
    }
    await tx.$queryRaw`SELECT id FROM "VisitorRequest" WHERE id=${input.id} AND "organizationId"=${session.organizationId} FOR UPDATE`;
    const visit = await tx.visitorRequest.findFirst({ where: { id: input.id, organizationId: session.organizationId, ...(tenant ? { studentId: (session as TenantSession).studentId } : {}) } });
    if (!visit || !visitTransition(visit.status, input.action)) return { error: "This action is no longer available. Refresh the visitor record." };
    if (["APPROVE", "CHECK_IN", "CHECK_OUT"].includes(input.action) && !input.verified) return { error: "Confirm that you personally verified this action." };
    if (["APPROVE", "CHECK_IN"].includes(input.action)) {
      const occupancy = await tx.occupancy.findFirst({ where: { id: visit.occupancyId, organizationId: session.organizationId, studentId: visit.studentId, status: "ACTIVE", student: { status: "ACTIVE", organizationId: session.organizationId }, room: { organizationId: session.organizationId, propertyId: visit.propertyId, property: { active: true } } } });
      if (!occupancy || visit.expectedDeparture <= now) return { error: "The host is no longer allocated here, or this visitor request has expired." };
      if (input.action === "CHECK_IN" && visit.expectedArrival.getTime() > now.getTime() + 60 * 60000) return { error: "Arrival is more than an hour early. Ask the tenant to submit the correct visit time." };
    }
    const status = ({ APPROVE: "APPROVED", DENY: "DENIED", CHECK_IN: "CHECKED_IN", CHECK_OUT: "CHECKED_OUT", CANCEL: "CANCELLED" })[input.action];
    await tx.visitorRequest.update({ where: { id: visit.id }, data: { status, reviewNote: input.note || visit.reviewNote, ...(input.action === "CHECK_IN" ? { checkedInAt: now, verifiedById: (session as SessionPayload).userId } : {}), ...(input.action === "CHECK_OUT" ? { checkedOutAt: now, checkedOutById: (session as SessionPayload).userId } : {}) } });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: tenant ? undefined : (session as SessionPayload).userId, action: `VISITOR_${input.action}`, entityType: "VisitorRequest", entityId: visit.id, metadata: { from: visit.status, to: status, verified: input.verified } } });
    return { success: input.action === "CHECK_OUT" ? "Departure verified and check-out recorded." : "Visitor record updated." };
  });
}
