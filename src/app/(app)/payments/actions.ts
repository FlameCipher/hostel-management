"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { validAmount, formatMoney } from "@/lib/currency";
import { organizationCurrency } from "@/lib/organization-currency";
import { recordPayment } from "@/lib/payment-recording";
import { db } from "@/lib/db";
import { deliverPaymentReceipt } from "@/lib/receipt-delivery";

export type FinanceFormState = { error: string };

async function requireFinanceManager() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/payments");
  return session;
}

const chargeSchema = z.object({
  studentId: z.string().min(1), semesterId: z.string().optional(), roomTypeId: z.string().optional(),
  type: z.enum(["SEMESTER_RENT", "DAMAGE", "OTHER"]), description: z.string().trim().min(3).max(160),
  amount: z.coerce.number().positive().max(1_000_000), dueDate: z.string().date(),
});

export async function createChargeAction(_state: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const session = await requireFinanceManager();
  const currency = await organizationCurrency(session.organizationId);
  const parsed = chargeSchema.safeParse({ studentId: formData.get("studentId"), semesterId: formData.get("semesterId") || undefined, roomTypeId: formData.get("roomTypeId") || undefined, type: formData.get("type"), description: formData.get("description"), amount: formData.get("amount"), dueDate: formData.get("dueDate") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the charge details." };
  if (formData.get("currency") !== currency || !validAmount(parsed.data.amount, currency)) return {error:"Reload this page and enter the amount using the currency’s supported decimal places."};
  const [student, semester] = await Promise.all([
    db.student.findFirst({ where: { id: parsed.data.studentId, organizationId: session.organizationId } }),
    parsed.data.semesterId ? db.semester.findFirst({ where: { id: parsed.data.semesterId, organizationId: session.organizationId } }) : null,
  ]);
  if (!student) return { error: "The selected student is unavailable." };
  if (parsed.data.semesterId && !semester) return { error: "The selected semester is unavailable." };
  if (parsed.data.type === "SEMESTER_RENT" && !semester) return { error: "Select a semester for a semester-rent charge." };
  if (parsed.data.type === "SEMESTER_RENT" && !parsed.data.roomTypeId) return { error: "Select an accommodation type for a semester-rent charge." };
  const roomType = parsed.data.roomTypeId ? await db.roomType.findFirst({ where: { id: parsed.data.roomTypeId, organizationId: session.organizationId, active: true } }) : null;
  if (parsed.data.roomTypeId && !roomType) return { error: "The selected accommodation type is unavailable." };
  if (parsed.data.type === "SEMESTER_RENT" && semester) {
    const duplicate = await db.charge.findFirst({ where: { organizationId: session.organizationId, studentId: student.id, semesterId: semester.id, type: "SEMESTER_RENT" } });
    if (duplicate) return { error: "This student already has a rent charge for the selected semester." };
  }
  await db.$transaction(async (tx) => {
    const charge = await tx.charge.create({ data: { currency, organizationId: session.organizationId, studentId: student.id, semesterId: semester?.id, roomTypeId: roomType?.id, type: parsed.data.type, description: parsed.data.description, amount: parsed.data.amount, baseAmount: parsed.data.amount, dueDate: new Date(`${parsed.data.dueDate}T12:00:00.000Z`), status: "UNPAID" } });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "CHARGE_CREATED", entityType: "Charge", entityId: charge.id, metadata: { type: charge.type, amount: Number(charge.amount), studentId: student.id } } });
  });
  revalidatePath("/payments"); revalidatePath("/dashboard"); redirect("/payments");
}

const paymentSchema = z.object({
  chargeId: z.string().min(1), amount: z.coerce.number().positive().max(1_000_000), paidAt: z.string().date(),
  method: z.enum(["MPESA", "BANK_TRANSFER", "CASH", "CARD", "OTHER"]), reference: z.string().trim().max(100).optional(),
  nextBalanceDueDate: z.string().date().optional(), notes: z.string().trim().max(500).optional(),
});

export async function recordPaymentAction(_state: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const session = await requireFinanceManager();
  const currency = await organizationCurrency(session.organizationId);
  const parsed = paymentSchema.safeParse({ chargeId: formData.get("chargeId"), amount: formData.get("amount"), paidAt: formData.get("paidAt"), method: formData.get("method"), reference: formData.get("reference") || undefined, nextBalanceDueDate: formData.get("nextBalanceDueDate") || undefined, notes: formData.get("notes") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the payment details." };
  if (formData.get("currency") !== currency || !validAmount(parsed.data.amount, currency)) return {error:"Reload this page and enter the amount using the currency’s supported decimal places."};
  if (["MPESA", "BANK_TRANSFER", "CARD"].includes(parsed.data.method) && !parsed.data.reference) return { error: "Enter the M-Pesa or transaction reference number." };

  let paymentId = "";
  let requiresRoomAllocation = false;
  try {
    ({paymentId, requiresRoomAllocation} = await recordPayment(db, session, {...parsed.data, currency}));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "FINANCE_ACCESS_DENIED") return {error:"Your access changed. Sign in again."};
    if (message === "CURRENCY_MISMATCH") return {error:"Currency changed. Reload this page."};
    if (message === "CHARGE_NOT_FOUND") return { error: "The selected charge is unavailable." };
    if (message === "ORGANIZATION_NOT_FOUND") return { error: "Organization settings are unavailable." };
    if (message === "CHARGE_PAID") return { error: "This charge has already been fully paid." };
    if (message.startsWith("DUPLICATE_REFERENCE:")) return { error: `This M-Pesa reference is already recorded on receipt ${message.split(":")[1]}.` };
    if (message.startsWith("OVERPAY:")) return { error: `Payment exceeds the remaining balance of ${formatMoney(Number(message.split(":")[1]), currency)}.` };
    throw error;
  }
  revalidatePath("/payments"); revalidatePath("/dashboard");
  if (requiresRoomAllocation) redirect(`/occupancy/check-in?paymentId=${paymentId}`);
  const delivery = await deliverPaymentReceipt(paymentId, session.organizationId);
  revalidatePath(`/payments/${paymentId}/receipt`);
  redirect(`/payments/${paymentId}/receipt?delivery=${delivery}`);
}
