"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { validAmount } from "@/lib/currency";
import { correctRecordedPaymentAmount } from "@/lib/payment-amount-correction";
import { deliverPaymentReceipt } from "@/lib/receipt-delivery";

export type PaymentAmountCorrectionState = {error: string};
const schema = z.object({
  correctedAmount: z.coerce.number().positive().max(1_000_000),
  originalAmount: z.coerce.number().positive().max(1_000_000),
  reason: z.string().trim().min(12, "Explain the correction in at least 12 characters.").max(350),
});

export async function correctPaymentAmountAction(
  paymentId: string,
  _state: PaymentAmountCorrectionState,
  formData: FormData,
): Promise<PaymentAmountCorrectionState> {
  const session = await requireSession();
  if (!["OWNER", "ADMIN"].includes(session.role))
    return {error: "Only the Owner or Admin can correct a posted receipt."};
  if (formData.get("acknowledge") !== "on")
    return {error: "Confirm that this is an internal correction, not a new payment or a refund."};
  const parsed = schema.safeParse({
    correctedAmount: formData.get("correctedAmount"),
    originalAmount: formData.get("originalAmount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return {error: parsed.error.issues[0]?.message ?? "Check the correction details."};
  if (!validAmount(parsed.data.correctedAmount, String(formData.get("currency"))))
    return {error: "Enter an amount supported by the hostel currency."};
  let replacementId: string;
  let originalPaymentId: string;
  let chargeId: string;
  try {
    const result = await correctRecordedPaymentAmount(db, session, {
      paymentId, ...parsed.data,
    });
    replacementId=result.paymentId;
    originalPaymentId=result.originalPaymentId;
    chargeId=result.chargeId;
  } catch (error) {
    const key = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      GATEWAY_VERIFIED_PAYMENT: "This amount was confirmed by Pesapal and cannot be edited. Review any charge or allocation issue separately.",
      CORRECTION_NOT_AUTHORIZED: "Your finance permission has changed. Sign in again.",
      PAYMENT_NOT_FOUND: "The payment no longer exists in your hostel.",
      PAYMENT_ALREADY_REVERSED: "This receipt was already reversed. No duplicate correction was made.",
      PAYMENT_CHANGED: "The original payment amount changed. Reload before proceeding.",
      IMPORTED_MPESA_REVIEW: "This payment is linked to an imported M-Pesa transaction. Review the provider reconciliation first.",
      CHARGE_CHANGED: "The student charge is unavailable, waived or no longer matches this payment.",
      DUPLICATE_REFERENCE: "Another active payment already uses this M-Pesa reference.",
      INVALID_AMOUNT: "Enter a valid positive payment amount.",
      UNCHANGED_AMOUNT: "The corrected amount must differ from the original amount.",
      REPLACEMENT_EXCEEDS_CHARGE: "The corrected payment would exceed the student's charge.",
      INCONSISTENT_LEDGER: "Recorded payments need investigation before a correction can be made.",
      ORGANIZATION_NOT_FOUND: "Hostel receipt settings are unavailable.",
    };
    return {error: messages[key] ?? "The correction could not be completed safely. Nothing is confirmed; reload and check the ledger."};
  }
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath(`/payments/${originalPaymentId}/receipt`);
  revalidatePath(`/payments/${replacementId}/receipt`);
  revalidatePath("/occupancy");
  void chargeId;
  let delivery = "not-requested";
  if (formData.get("emailReplacement") === "on") {
    delivery = await deliverPaymentReceipt(replacementId, session.organizationId);
    revalidatePath(`/payments/${replacementId}/receipt`);
  }
  redirect(`/payments/${replacementId}/receipt?correction=applied&delivery=${encodeURIComponent(delivery)}`);
}
