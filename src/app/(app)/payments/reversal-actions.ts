"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { refreshChargeStatus } from "@/lib/payment-balance";

export type ReversalFormState = { error: string };

const schema = z.object({
  paymentId: z.string().min(1),
  reversalType: z.enum(["INTERNAL_CORRECTION", "MPESA_CONFIRMED"]),
  reason: z.string().trim().min(8, "Give a clear reason of at least 8 characters.").max(500),
});

export async function reversePaymentAction(_state: ReversalFormState, formData: FormData): Promise<ReversalFormState> {
  const session = await requireSession();
  if (!(["OWNER", "ADMIN"] as const).includes(session.role as "OWNER" | "ADMIN")) return { error: "Only the Owner or an Admin can reverse payments." };
  const parsed = schema.safeParse({ paymentId: formData.get("paymentId"), reversalType: formData.get("reversalType"), reason: formData.get("reason") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the reversal details." };

  try {
    await db.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: parsed.data.paymentId, organizationId: session.organizationId },
        include: { mpesaTransaction: true },
      });
      if (!payment) throw new Error("NOT_FOUND");
      if (payment.reversedAt) throw new Error("ALREADY_REVERSED");
      if (parsed.data.reversalType === "MPESA_CONFIRMED" && payment.method !== "MPESA") throw new Error("NOT_MPESA");

      const reversedAt = new Date();
      const result = await tx.payment.updateMany({ where: { id: payment.id, reversedAt: null }, data: { reversedAt, reversedById: session.userId, reversalReason: parsed.data.reason, reversalType: parsed.data.reversalType } });
      if (result.count !== 1) throw new Error("ALREADY_REVERSED");

      if (payment.mpesaTransaction) {
        await tx.mpesaTransaction.update({
          where: { id: payment.mpesaTransaction.id },
          data: parsed.data.reversalType === "MPESA_CONFIRMED"
            ? { status: "REVERSED", notes: parsed.data.reason }
            : { paymentId: null, status: "UNMATCHED", matchedAt: null, notes: `Payment ${payment.receiptNumber} was internally corrected.` },
        });
      }

      await refreshChargeStatus(tx, payment.chargeId);
      await tx.auditLog.create({ data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: parsed.data.reversalType === "MPESA_CONFIRMED" ? "PAYMENT_REVERSAL_CONFIRMED" : "PAYMENT_REVERSED_INTERNAL",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { receiptNumber: payment.receiptNumber, amount: Number(payment.amount), reason: parsed.data.reason, reversalType: parsed.data.reversalType },
      } });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return { error: "Payment not found." };
    if (message === "ALREADY_REVERSED") return { error: "This payment has already been reversed." };
    if (message === "NOT_MPESA") return { error: "A confirmed M-Pesa reversal can only be used for an M-Pesa payment." };
    throw error;
  }

  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath(`/payments/${parsed.data.paymentId}/receipt`);
  redirect(`/payments/${parsed.data.paymentId}/receipt`);
}
