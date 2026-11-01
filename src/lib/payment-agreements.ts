import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { localSessionCurrent } from "@/lib/account-security-policy";
import { tenantWhere } from "@/lib/communications";
import { parseAgreementDate } from "./payment-agreement-policy";

export async function savePaymentAgreement(db: PrismaClient, session: SessionPayload | null, input: { studentId: string; date: string; note: string; expectedUpdatedAt: string; clear: boolean; confirmed: boolean }, now = new Date()) {
  if (!session) return { error: "Management sign-in is required." };
  const note = input.note.trim(), date = input.clear ? null : parseAgreementDate(input.date, now);
  if (!input.confirmed || !input.studentId || input.studentId.length > 128 || note.length < 5 || note.length > 500 || (!input.clear && !date)) return { error: "Confirm the agreement, enter a date from today up to one year ahead, and record a short reason." };
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR UPDATE`;
    const actor = await tx.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, active: true, role: { in: ["OWNER", "ADMIN", "MANAGER"] }, organization: { status: "ACTIVE" } }, select: { sessionVersion: true } });
    if (!actor || !localSessionCurrent(session.sessionVersion, actor.sessionVersion)) return { error: "Only active management can record payment agreements." };
    const student = await tx.student.findFirst({ where: { ...tenantWhere(session.organizationId), id: input.studentId }, select: { id: true, paymentAgreedDate: true, paymentAgreementNote: true, paymentAgreementUpdatedAt: true } });
    if (!student) return { error: "This current tenant could not be found in your hostel." };
    if ((student.paymentAgreementUpdatedAt?.toISOString() ?? "") !== input.expectedUpdatedAt) return { error: "The agreement changed. Refresh and review it before saving." };
    await tx.student.update({ where: { id: student.id }, data: { paymentAgreedDate: date, paymentAgreementNote: input.clear ? null : note, paymentAgreementUpdatedAt: now } });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: input.clear ? "PAYMENT_AGREEMENT_CLEARED" : "PAYMENT_AGREEMENT_RECORDED", entityType: "Student", entityId: student.id, metadata: { previousDate: student.paymentAgreedDate?.toISOString().slice(0,10) ?? null, agreedDate: date?.toISOString().slice(0,10) ?? null, note } } });
    return { success: input.clear ? "Agreement cleared. Eligible overdue demands can resume." : "Agreement saved. Payment demands are paused through the agreed date." };
  });
}
