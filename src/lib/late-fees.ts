import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { arrearsPosition } from "./arrears-policy";
import { snapshotSchema, termsHash } from "./hostel-terms/policy";
import { LATE_FEE_ORGANIZATION, LATE_FEE_VERSION, firstLateFeeDeadline, hostelDay, lateFeeAmount, lateFeeDeadline, displayHostelDate } from "./late-fee-policy";
import { formatMoney } from "./currency";
import { tenantWhere } from "./communications";

type Reader = Pick<Prisma.TransactionClient, "charge" | "studentTermsAcceptance" | "organization">;
export async function readLateFees(db: Reader, organizationId: string, now = new Date(), studentIds?: string[]) {
  if (organizationId !== LATE_FEE_ORGANIZATION) return [];
  const org = await db.organization.findFirst({ where: { id: organizationId, status: "ACTIVE" }, select: { currency: true } });
  if (!org) return [];
  const charges = await db.charge.findMany({ where: { organizationId, type: "SEMESTER_RENT", status: { not: "WAIVED" }, student: tenantWhere(organizationId), ...(studentIds ? { studentId: { in: studentIds } } : {}) }, include: {
    payments: { where: { reversedAt: null } }, lateFeeCharge: true,
    student: { select: { fullName: true, paymentAgreedDate: true, occupancies: { where: { organizationId, status: { in: ["ACTIVE", "RESERVED"] }, room: { organizationId }, semester: { organizationId } }, select: { id: true, semesterId: true } } } },
  }, orderBy: { id: "asc" }, take: 2001 });
  if (charges.length > 2000) throw Error("Late-fee register exceeds the review limit.");
  const records = await db.studentTermsAcceptance.findMany({ where: { organizationId, version: LATE_FEE_VERSION, occupancyId: { in: charges.flatMap(c => c.student.occupancies.map(o => o.id)) } } });
  return charges.flatMap(charge => {
    const balance = arrearsPosition([charge], organizationId, charge.studentId, org.currency, now, "Africa/Nairobi", true);
    if (balance.error || charge.payments.some(p => Number(p.amount) < 0) || (charge.lateFeeCharge && (charge.lateFeeCharge.organizationId !== organizationId || charge.lateFeeCharge.studentId !== charge.studentId || charge.lateFeeCharge.currency !== org.currency))) return [{ chargeId: charge.id, studentId: charge.studentId, name: charge.student.fullName, currency: org.currency, basis: 0, fee: 0, deadline: "", termsId: "", occupancyId: "", eligible: false, state: "Account needs review", message: "" }];
    if (!balance.balance && !charge.lateFeeCharge) return [];
    const allocations = charge.student.occupancies.filter(o => charge.occupancyId ? o.id === charge.occupancyId : o.semesterId === charge.semesterId);
    const occupancy = allocations.length === 1 ? allocations[0] : null;
    const record = occupancy ? records.find(r => r.studentId === charge.studentId && r.occupancyId === occupancy.id) : null;
    let notBefore = "";
    if (record && record.acceptedAt <= now) {
      const parsed = snapshotSchema.safeParse(record.snapshot);
      if (parsed.success && parsed.data.version === LATE_FEE_VERSION && parsed.data.lateFeePolicy?.rate === 10 && parsed.data.lateFeePolicy.notBeforeDate === firstLateFeeDeadline(record.acceptedAt) && record.integrityHash === termsHash(parsed.data, record.signatureName, record.acceptedAt, record.reference)) notBefore = parsed.data.lateFeePolicy.notBeforeDate;
    }
    const deadline = notBefore ? lateFeeDeadline(charge.dueDate, notBefore, charge.student.paymentAgreedDate) : "";
    const existing = charge.lateFeeCharge;
    const fee = lateFeeAmount(balance.balance ?? 0, org.currency);
    const eligible = !!(deadline && deadline < hostelDay(now) && fee > 0 && !existing);
    const state = existing ? (existing.status === "WAIVED" ? "Fee waived — will not repeat" : "Fee already recorded") : !deadline ? "Awaiting student acceptance" : eligible ? "Due at the next daily check" : "Within payment deadline";
    const message = existing ? (existing.status === "WAIVED" ? "The late-payment charge for this rent was waived and will not be applied again." : `A one-time 10% late-payment charge of ${formatMoney(Number(existing.amount), org.currency)} has been recorded separately on your account. It will not be charged again on this rent.`) : deadline ? `Under your accepted accommodation terms, a one-time 10% charge applies to rent still unpaid after ${displayHostelDate(deadline)}. Your current unpaid rent for this charge is ${formatMoney(balance.balance ?? 0, org.currency)}; at this balance the fee would be ${formatMoney(fee, org.currency)}. Payments received before assessment reduce the fee. An approved later payment date takes priority.` : "The new one-time 10% late-payment rule applies only after you accept the updated accommodation terms and the system-calculated deadline passes. No late-payment fee has been added for this rent.";
    return [{ chargeId: charge.id, studentId: charge.studentId, name: charge.student.fullName, currency: org.currency, basis: balance.balance ?? 0, fee, deadline, termsId: record?.id ?? "", occupancyId: occupancy?.id ?? "", eligible, state, message }];
  });
}

export async function runLateFees(db: PrismaClient, now = new Date()) {
  const orgId = LATE_FEE_ORGANIZATION;
  const candidates = (await readLateFees(db, orgId, now)).filter(r => r.eligible);
  let created = 0;
  for (const candidate of candidates) {
    const added = await db.$transaction(async tx => {
      // Same order as payment posting and payment-agreement changes.
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${orgId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${candidate.studentId} AND "organizationId"=${orgId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "SemesterCharge" WHERE id=${candidate.chargeId} AND "organizationId"=${orgId} FOR UPDATE`;
      const row = (await readLateFees(tx, orgId, now, [candidate.studentId])).find(r => r.chargeId === candidate.chargeId);
      if (!row?.eligible) return false;
      const parent = await tx.charge.findUniqueOrThrow({ where: { id: row.chargeId } });
      const charge = await tx.charge.create({ data: { organizationId: orgId, studentId: row.studentId, semesterId: parent.semesterId, occupancyId: row.occupancyId, currency: row.currency, type: "OTHER", description: `One-time 10% late-payment fee · ${parent.description}`.slice(0,160), amount: row.fee, baseAmount: row.fee, dueDate: now, status: "UNPAID", lateFeeForChargeId: row.chargeId, lateFeeTermsId: row.termsId, lateFeeBasis: row.basis } });
      await tx.auditLog.create({ data: { organizationId: orgId, action: "RENT_LATE_FEE_APPLIED", entityType: "Charge", entityId: charge.id, metadata: { rentChargeId: row.chargeId, studentId: row.studentId, termsId: row.termsId, deadline: row.deadline, ratePercent: 10, principal: row.basis, fee: row.fee, assessedAt: now.toISOString() } } });
      return true;
    }, { timeout: 30000 });
    if (added) created++;
  }
  return { created };
}
