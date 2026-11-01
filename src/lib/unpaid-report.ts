import { createHash } from "node:crypto";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { SessionPayload } from "./auth/session";
import { residentStaff } from "./resident-access";
import { tenantWhere } from "./communications";
import { arrearsPosition } from "./arrears-policy";
import { agreementActive } from "./payment-agreement-policy";
import { whatsappNumber } from "./whatsapp-policy";
import { formatMoney } from "./currency";

type Reader = Pick<Prisma.TransactionClient, "student" | "organization">;
export async function readUnpaidReport(db: Reader, organizationId: string, now = new Date()) {
  const [org, students] = await Promise.all([
    db.organization.findFirst({ where: { id: organizationId, status: "ACTIVE" }, select: { name: true, currency: true } }),
    db.student.findMany({ where: tenantWhere(organizationId), select: { id: true, fullName: true, gender: true, paymentAgreedDate: true,
      occupancies: { where: { organizationId, status: { in: ["ACTIVE", "RESERVED"] } }, select: { room: { select: { number: true } } }, orderBy: { createdAt: "desc" }, take: 1 },
      charges: { where: { organizationId, status: { not: "WAIVED" } }, select: { id: true, organizationId: true, studentId: true, currency: true, amount: true, dueDate: true, status: true, payments: { where: { reversedAt: null }, select: { amount: true, organizationId: true, studentId: true, currency: true, reversedAt: true } } } },
    }, orderBy: { fullName: "asc" }, take: 1001 }),
  ]);
  if (!org || students.length > 1000) throw new Error("Report unavailable. Maximum 1,000 current students per report.");
  let reviewCount = 0;
  const rows = students.flatMap(student => {
    const total = arrearsPosition(student.charges, organizationId, student.id, org.currency, now, "Africa/Nairobi", true);
    const overdue = arrearsPosition(student.charges, organizationId, student.id, org.currency, now, "Africa/Nairobi");
    if (total.error || overdue.error) { reviewCount++; return []; }
    if (!total.balance) return [];
    const agreed = agreementActive(student.paymentAgreedDate, now);
    return [{ studentId: student.id, name: student.fullName, gender: student.gender, room: student.occupancies[0]?.room.number ?? "—", balance: formatMoney(total.balance, org.currency), overdue: formatMoney(overdue.balance ?? 0, org.currency), status: agreed ? "Agreed until " + student.paymentAgreedDate!.toISOString().slice(0,10) : overdue.balance ? "Overdue" : "Not overdue", demandEligible: !agreed && !!overdue.balance }];
  });
  return { organizationName: org.name, rows, reviewCount, generatedAt: now.toISOString(), fingerprint: createHash("sha256").update(JSON.stringify({ rows, reviewCount })).digest("hex") };
}
export type UnpaidReport = Awaited<ReturnType<typeof readUnpaidReport>>;

export async function prepareStaffReport(db: PrismaClient, session: SessionPayload | null, input: { recipientId: string; recipientPhone: string; fingerprint: string; confirmed: boolean }, now = new Date()) {
  if (!session || !input.confirmed || !/^[a-f0-9]{64}$/.test(input.fingerprint) || input.recipientId.length > 128) return { error: "Review the report and choose a staff recipient before generating the PDF." };
  return db.$transaction(async tx => {
    if (!await residentStaff(tx, session, true)) return { error: "Active management access is required." };
    const recipient = await tx.user.findFirst({ where: { id: input.recipientId, organizationId: session.organizationId, active: true }, select: { id: true, name: true, role: true, phone: true } });
    const phone = whatsappNumber(recipient?.phone, "KE");
    if (!recipient || !phone || phone !== input.recipientPhone) return { error: "The staff contact is unavailable or changed. Refresh and select the correct active staff member." };
    const report = await readUnpaidReport(tx, session.organizationId, now);
    if (report.fingerprint !== input.fingerprint) return { error: "Balances or agreements changed. Refresh and review the report before sharing." };
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "UNPAID_STAFF_PDF_PREPARED", entityType: "User", entityId: recipient.id, metadata: { recipientId: recipient.id, count: report.rows.length, fingerprint: report.fingerprint, delivery: "NOT_SENT" } } });
    return { report, recipient: { name: recipient.name, role: recipient.role } };
  }, { timeout: 30000 });
}
