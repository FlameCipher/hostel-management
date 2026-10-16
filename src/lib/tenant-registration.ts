import { hash } from "bcryptjs";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "./auth/session";
import { verifyBookingTicket } from "./booking-requests";
import { publishedWhere } from "./property-host-policy";
import { residentStaff } from "./resident-access";
import { whatsappNumber } from "./whatsapp-policy";
import { normalizedResidentName } from "./resident-policy";

/**
 * MMAMBUGUA HOSTEL is a verified Kenya-based organization. Older records can
 * lack a countryCode, but residents must still be able to enter the 07/01
 * mobile number management holds on file. Never guess the country for other
 * organizations, or override an explicitly configured different country.
 */
export function registrationCountryCode(countryCode:string|null|undefined,organizationId:string):string|null {
 return countryCode || (organizationId==="mama-mbugua-hostel"?"KE":null);
}
const schema = z.object({ fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(8).max(30), roomNumber: z.string().trim().min(1).max(40), password: z.string().min(10).max(128).refine(v => Buffer.byteLength(v, "utf8") <= 72), confirmation: z.string().max(128), consent: z.literal(true) }).refine(v => v.password === v.confirmation);
export async function submitTenantRegistration(db: PrismaClient, propertyId: string, raw: unknown, ticket: unknown, fingerprint: string, now = new Date()): Promise<{ error?: string; success?: string }> {
  const parsed = schema.safeParse(raw), signed = verifyBookingTicket(ticket, `registration:${propertyId}`, now);
  if (!parsed.success || !signed || !fingerprint) return { error: "Complete your details and matching passwords (10 characters minimum, up to 72 UTF-8 bytes). Refresh this page if it has expired." };
  const property = await db.property.findFirst({ where: { id: propertyId, ...publishedWhere() } });
  if (!property) return { error: "Open your hostel website to register." };
  const phone = whatsappNumber(parsed.data.phone, registrationCountryCode(property.countryCode,property.organizationId));
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
  const parsed = z.object({ id: z.string().min(1).max(128), studentId: z.string().max(128), approve: z.boolean(), verified: z.boolean(), rejectionReason: z.enum(["NO_MATCH","WRONG_PHONE","WRONG_ROOM","CONFLICTING_REQUEST","DUPLICATE","OTHER"]).optional(), reviewNote: z.string().trim().max(300).optional() }).safeParse(raw);
  if (!session || !parsed.success) return { error: "Registration unavailable." };
  const input = parsed.data;
  if (!input.approve && !input.rejectionReason)
    return {error:"Choose a reason when rejecting a registration request."};
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
    // Submission also takes an exclusive property lock. Lock this property
    // before approving to prevent a later same-number request racing approval.
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${row.propertyId} AND "organizationId"=${session.organizationId} FOR SHARE`;
    const related = await tx.tenantRegistration.findMany({
      where:{
        organizationId:session.organizationId,
        propertyId:row.propertyId,
        phone:row.phone,
        status:"PENDING",expiresAt:{gt:now},
      },
      select:{
        id:true,organizationId:true,propertyId:true,fullName:true,
        phone:true,roomNumber:true,createdAt:true,expiresAt:true,status:true,
      },
    });
    // A valid exact identity is name + registered number + CURRENT room,
    // not simply "someone entered this phone". A reused number requires
    // conflicting attempts to be investigated individually.
    const sameDetails=(candidate:{fullName:string;roomNumber:string})=>
      normalizedResidentName(candidate.fullName)===normalizedResidentName(row.fullName) &&
      candidate.roomNumber.trim().toLocaleLowerCase()===row.roomNumber.trim().toLocaleLowerCase();
    const identical=related.filter(sameDetails).sort((a,b)=>
      b.createdAt.getTime()-a.createdAt.getTime()||b.id.localeCompare(a.id));
    const otherClaims=related.some(candidate=>!sameDetails(candidate));
    if(input.approve){
      if(otherClaims)return {error:"This phone appears with different names or rooms. Reject or investigate the conflicting requests before approval."};
      if(identical[0]?.id!==row.id)return {error:"A newer registration exists for this student and room. Review the latest request; the earlier password must not be activated."};
    }
    let supersededCount=0;
    if (input.approve) {
      if (!input.verified || !input.studentId || !row.passwordHash) return { error: "Select the existing tenant and confirm that you independently verified their identity in person or through the contact already on file." };
      const student = await tx.student.findFirst({ where: { id: input.studentId, organizationId: session.organizationId, status: "ACTIVE", portalEnabled: false, portalPasswordHash: null, portalLastLoginAt: null, portalInviteBlocked: false, occupancies: { some: { organizationId: session.organizationId, status: "ACTIVE", room: { organizationId: session.organizationId, propertyId: row.propertyId, number: { equals: row.roomNumber, mode: "insensitive" } }, semester: { organizationId: session.organizationId } } } } });
      if (!student || !row.property.active || whatsappNumber(student.phone, registrationCountryCode(row.property.countryCode,row.organizationId)) !== row.phone || normalizedResidentName(student.fullName) !== normalizedResidentName(row.fullName)) return { error: "The name, registered phone and current room must match this hostel's existing tenant record. Existing, disabled or previously used portal accounts require the account recovery process." };
      await tx.student.update({ where: { id: student.id }, data: { portalEnabled: true, portalPasswordHash: row.passwordHash } });
      await tx.tenantPortalInvitation.updateMany({ where: { organizationId: session.organizationId, studentId: student.id, usedAt: null }, data: { tokenHash: null, status: "ACTIVATED", usedAt: now } });
      // After actual independent verification, older identical attempts have
      // no authority to re-enable access or overwrite the chosen password.
      const olderIds=identical.filter(attempt=>attempt.id!==row.id).map(attempt=>attempt.id);
      if(olderIds.length){
        const superseded=await tx.tenantRegistration.updateMany({
          where:{
            id:{in:olderIds},organizationId:session.organizationId,
            propertyId:row.propertyId,status:"PENDING",
          },
          data:{status:"SUPERSEDED",passwordHash:null,reviewedAt:now,reviewedById:session.userId},
        });
        if(superseded.count!==olderIds.length)throw Error("REGISTRATION_QUEUE_CHANGED");
        supersededCount=superseded.count;
      }
    } else if(identical[0]?.id===row.id && identical.length>1) {
      // A rejected newest attempt must not leave an older obsolete password
      // awaiting activation. Older identical requests require fresh submission.
      const olderIds=identical.slice(1).map(attempt=>attempt.id);
      const superseded=await tx.tenantRegistration.updateMany({
        where:{
          id:{in:olderIds},organizationId:session.organizationId,
          propertyId:row.propertyId,status:"PENDING",
        },
        data:{status:"SUPERSEDED",passwordHash:null,reviewedAt:now,reviewedById:session.userId},
      });
      if(superseded.count!==olderIds.length)throw Error("REGISTRATION_QUEUE_CHANGED");
      supersededCount=superseded.count;
    }
    await tx.tenantRegistration.update({ where: { id: row.id }, data: { status: input.approve ? "APPROVED" : "REJECTED", studentId: input.approve ? input.studentId : null, passwordHash: null, reviewedById: session.userId, reviewedAt: now } });
    await tx.auditLog.create({ data: {
      organizationId: session.organizationId, actorUserId: session.userId,
      action: input.approve ? "TENANT_REGISTRATION_APPROVED" : "TENANT_REGISTRATION_REJECTED",
      entityType: "TenantRegistration", entityId: row.id,
      metadata: {
        ...(input.approve ? {studentId:input.studentId,
          supersededAttempts:supersededCount,
          verifiedRequestIsLatest:true,
        } : {
          rejectionReason:input.rejectionReason,reviewNote:input.reviewNote||null,
          supersededAttempts:supersededCount,
        }),
        identityVerified: input.approve?input.verified:false,
        notifiedByPlatform:false,
      },
    } });
    return {success:input.approve ?
      "Existing tenant account activated after independent verification. Older identical requests were safely superseded; no messages were sent." :
      "Registration request rejected with an audit reason; outdated identical passwords were invalidated. No tenant account was activated."};
  });
}
