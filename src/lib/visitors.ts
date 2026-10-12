import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantSession } from "./auth/tenant-session";
import type { SessionPayload } from "./auth/session";
import { residentStaff, residentTenant } from "./resident-access";
import { hostelTimeZone, visitLocalTime, visitTransition } from "./resident-policy";
import { whatsappNumber } from "./whatsapp-policy";
import { visitGatePreflight } from "./visitor-operations-policy";
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
    const overlapping=await tx.visitorRequest.findFirst({where:{
      organizationId:session.organizationId,
      propertyId:property.id,studentId:session.studentId,
      visitorPhone:phone,
      status:{in:["REQUESTED","APPROVED","CHECKED_IN"]},
      expectedArrival:{lt:departure},
      expectedDeparture:{gt:arrival},
    },select:{id:true}});
    if(overlapping)return {error:"A visitor request for this phone already overlaps these dates. Check My visitors before submitting another."};
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
    const occupancy = ["APPROVE","CHECK_IN"].includes(input.action)
      ? await tx.occupancy.findFirst({
          where:{
            id:visit.occupancyId,organizationId:session.organizationId,
            studentId:visit.studentId,status:"ACTIVE",
            student:{status:"ACTIVE",organizationId:session.organizationId},
            room:{
              organizationId:session.organizationId,
              propertyId:visit.propertyId,property:{active:true},
            },
          },
          include:{room:{select:{number:true,propertyId:true}}},
        })
      : null;
    const issue=visitGatePreflight(visit,input.action,now,occupancy?{
      roomNumber:occupancy.room.number,
      propertyId:occupancy.room.propertyId,
      studentId:occupancy.studentId,
      active:true,
    }:null);
    if(issue){
      const errors:Record<string,string>={
        HOST_NO_LONGER_ELIGIBLE:"The student no longer has an active room at this hostel. Do not admit the visitor.",
        HOST_ROOM_CHANGED:"The student has moved rooms since this request. Ask the host to submit a new visitor request for the current room.",
        VISIT_WINDOW_EXPIRED:"The visitor's expected visit has expired. The host must request a new visit.",
        ARRIVAL_TOO_EARLY:"The visitor is more than one hour early. Ask the host to confirm the expected arrival.",
        CHECKOUT_HISTORY_INVALID:"This visitor's checked-in timestamp is invalid or a departure was already recorded. Review the audit history.",
        INVALID_VISIT_HISTORY:"This visitor has inconsistent arrival or departure history. Review the record.",
        INVALID_CLOCK:"The server could not verify the current time.",
      };
      return {error:errors[issue]??"Visitor record needs review before gate verification."};
    }
    const status = ({ APPROVE: "APPROVED", DENY: "DENIED", CHECK_IN: "CHECKED_IN", CHECK_OUT: "CHECKED_OUT", CANCEL: "CANCELLED" })[input.action];
    await tx.visitorRequest.update({ where: { id: visit.id }, data: { status, reviewNote: input.note || visit.reviewNote, ...(input.action === "CHECK_IN" ? { checkedInAt: now, verifiedById: (session as SessionPayload).userId } : {}), ...(input.action === "CHECK_OUT" ? { checkedOutAt: now, checkedOutById: (session as SessionPayload).userId } : {}) } });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: tenant ? undefined : (session as SessionPayload).userId, action: `VISITOR_${input.action}`, entityType: "VisitorRequest", entityId: visit.id, metadata: { from: visit.status, to: status, verified: input.verified, propertyId: visit.propertyId, studentId: visit.studentId, roomLabel: visit.roomLabel, expectedArrival: visit.expectedArrival.toISOString(), expectedDeparture: visit.expectedDeparture.toISOString(), observedAt: now.toISOString(), ...(input.note ? { noteProvided: true } : {}) } } });
    return { success: input.action === "CHECK_OUT" ? "Departure verified and check-out recorded." : "Visitor record updated." };
  });
}
