import { randomBytes } from "node:crypto";
import type { PrismaClient, RentPaymentRequest, PaymentMethod } from "@/generated/prisma/client";
import { minorUnits, validAmount } from "@/lib/currency";
import { paymentReceiptIntegrityHash } from "@/lib/payment-receipt-integrity";
import { refreshChargeStatus } from "@/lib/payment-balance";
import type { PesapalStatus } from "@/lib/pesapal-api";

/** Only a server-to-server authenticated status response is accepted here. */
export function verifiedStatus(order: Pick<RentPaymentRequest, "id" | "amount" | "currency">, status: PesapalStatus) {
  if (String(status.status) !== "200" || status.merchant_reference !== order.id) throw Error("REFERENCE_MISMATCH");
  const code = Number(status.status_code);
  const expected = ["INVALID", "COMPLETED", "FAILED", "REVERSED"][code];
  if (!expected || status.payment_status_description?.toUpperCase() !== expected) throw Error("STATUS_MISMATCH");
  if (code === 1 || code === 3) {
    if (status.currency !== order.currency || !validAmount(Number(status.amount), order.currency) || minorUnits(Number(status.amount), order.currency) !== minorUnits(Number(order.amount), order.currency)) throw Error("AMOUNT_OR_CURRENCY_MISMATCH");
  }
  if (code === 1 && (typeof status.confirmation_code !== "string" || !status.confirmation_code.trim() || status.confirmation_code.length > 128)) throw Error("CONFIRMATION_MISSING");
  return code;
}

function paymentMethod(value: string): PaymentMethod {
  const method = value?.replace(/[^a-z]/gi, "").toUpperCase();
  return method === "MPESA" ? "MPESA" : ["CARD", "VISA", "MASTERCARD", "AMEX"].includes(method) ? "CARD" : "OTHER";
}

export async function applyVerifiedRentPayment(database: PrismaClient, orderId: string, trackingId: string, provider: PesapalStatus) {
  const snapshot = await database.rentPaymentRequest.findUniqueOrThrow({ where: { id: orderId } });
  return database.$transaction(async tx => {
    // Same lock order as manual payment entry; serializes receipt numbers and references.
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${snapshot.organizationId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "RentPaymentRequest" WHERE id=${orderId} FOR UPDATE`;
    const order = await tx.rentPaymentRequest.findUniqueOrThrow({ where: { id: orderId } });
    if (order.trackingId && order.trackingId.toLowerCase() !== trackingId.toLowerCase()) throw Error("TRACKING_MISMATCH");
    if (!order.trackingId && !["CREATING", "CHECKING"].includes(order.status)) throw Error("ORDER_NOT_SUBMITTED");
    if (provider.merchant_reference !== order.id) throw Error("REFERENCE_MISMATCH");
    const checked = { lastCheckedAt: new Date(), nextCheckAt: new Date(Date.now() + (order.paymentId ? 86_400_000 : 300_000)) };
    let code: number;
    try { code = verifiedStatus(order, provider); } catch (error) {
      await tx.rentPaymentRequest.update({ where: { id: order.id }, data: { ...checked, trackingId: trackingId.toLowerCase(), exception: error instanceof Error ? error.message : "VERIFICATION_FAILED", status: "REVIEW" } });
      return { status: "REVIEW", paymentId: order.paymentId };
    }
    await tx.$queryRaw`SELECT id FROM "SemesterCharge" WHERE id=${order.chargeId} AND "organizationId"=${order.organizationId} FOR UPDATE`;
    const charge = await tx.charge.findFirst({ where: { id: order.chargeId, organizationId: order.organizationId, studentId: order.studentId, currency: order.currency } });
    if (!charge) throw Error("CHARGE_BINDING_MISMATCH");
    const update = (data: Parameters<typeof tx.rentPaymentRequest.update>[0]["data"]) => tx.rentPaymentRequest.update({ where: { id: order.id }, data: { ...checked, trackingId: trackingId.toLowerCase(), ...data } });
    // A late completed notification cannot undo a confirmed reversal or a staff correction.
    if (order.status === "REVERSED") return { status: "REVERSED", paymentId: order.paymentId };
    if (code === 3) {
      if (order.paymentId) {
        await tx.payment.updateMany({ where: { id: order.paymentId, organizationId: order.organizationId, reversedAt: null }, data: { reversedAt: new Date(), reversalReason: "Reversal confirmed automatically by Pesapal.", reversalType: "GATEWAY_CONFIRMED" } });
        await tx.mpesaTransaction.updateMany({ where: { paymentId: order.paymentId, organizationId: order.organizationId }, data: { status: "REVERSED", notes: "Reversal verified automatically with Pesapal." } });
        await refreshChargeStatus(tx, order.chargeId);
      }
      await update({ status: "REVERSED", exception: null });
      await tx.auditLog.create({ data: { organizationId: order.organizationId, action: "PESAPAL_REVERSAL_VERIFIED", entityType: "RentPaymentRequest", entityId: order.id, metadata: { trackingId, paymentId: order.paymentId } } });
      return { status: "REVERSED", paymentId: order.paymentId };
    }
    if (order.paymentId) {
      // Never demote an issued receipt on a stale failed/invalid callback.
      const status = code === 1 ? "COMPLETED" : order.status;
      await update({ status, ...(code === 1 ? { exception: null } : {}) });
      return { status, paymentId: order.paymentId };
    }
    if (code !== 1) {
      const status = code === 2 ? "FAILED" : "PENDING";
      await update({ status, exception: null });
      return { status, paymentId: null };
    }
    const dateText = provider.created_date;
    const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(dateText) ? dateText : dateText + "Z");
    if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 300_000) {
      await update({ status: "REVIEW", exception: "PAYMENT_DATE_INVALID" });
      return { status: "REVIEW", paymentId: null };
    }
    const method = paymentMethod(provider.payment_method);
    const reference = provider.confirmation_code.trim().toUpperCase();
    const duplicate = await tx.payment.findFirst({ where: { organizationId: order.organizationId, reference: { equals: reference, mode: "insensitive" } }, include: { rentPaymentRequest: { select: { id: true } } } });
    if (duplicate) {
      // A manually recorded payment may already represent this exact transaction.
      if (duplicate.reversedAt || duplicate.rentPaymentRequest || duplicate.chargeId !== order.chargeId || duplicate.currency !== order.currency || minorUnits(Number(duplicate.amount), order.currency) !== minorUnits(Number(order.amount), order.currency) || duplicate.method !== method) {
        await update({ status: "REVIEW", exception: "REFERENCE_ALREADY_USED" });
        return { status: "REVIEW", paymentId: null };
      }
      await update({ status: "COMPLETED", paymentId: duplicate.id, confirmationCode: reference, exception: null });
      await tx.auditLog.create({ data: { organizationId: order.organizationId, action: "PESAPAL_EXISTING_PAYMENT_VERIFIED", entityType: "Payment", entityId: duplicate.id, metadata: { requestId: order.id, trackingId } } });
      return { status: "COMPLETED", paymentId: duplicate.id };
    }
    const organization = await tx.organization.findUniqueOrThrow({ where: { id: order.organizationId }, select: { receiptPrefix: true } });
    const year = date.getUTCFullYear();
    const sequence = await tx.receiptSequence.upsert({ where: { organizationId_year: { organizationId: order.organizationId, year } }, create: { organizationId: order.organizationId, year, lastIssued: 1 }, update: { lastIssued: { increment: 1 } } });
    const receiptNumber = `${organization.receiptPrefix}-${year}-${String(sequence.lastIssued).padStart(5, "0")}`;
    const issuedAt = new Date(), securityReference = `SH-${randomBytes(16).toString("hex").toUpperCase()}`;
    const paidAt = date.toISOString().slice(0, 10);
    const integrityHash = paymentReceiptIntegrityHash({ organizationId: order.organizationId, studentId: order.studentId, chargeId: order.chargeId, receiptNumber, securityReference, currency: order.currency, amount: Number(order.amount), paidAt, method, reference, issuedAt });
    // Record money actually received even if a concurrent payment or charge adjustment
    // leaves a credit. Never silently drop a confirmed payment as an "overpayment".
    const payment = await tx.payment.create({ data: { organizationId: order.organizationId, studentId: order.studentId, chargeId: order.chargeId, amount: order.amount, currency: order.currency, paidAt: new Date(paidAt + "T12:00:00.000Z"), method, reference, receiptNumber, securityReference, integrityHash, issuedAt, notes: "Automatically verified with Pesapal; " + order.id } });
    if (method === "MPESA") {
      await tx.mpesaTransaction.updateMany({ where: { organizationId: order.organizationId, transactionCode: reference, paymentId: null, currency: order.currency, amount: order.amount }, data: { paymentId: payment.id, status: "MATCHED", matchedAt: new Date(), notes: "Verified with Pesapal." } });
    }
    await update({ status: "COMPLETED", paymentId: payment.id, confirmationCode: reference, exception: null });
    await refreshChargeStatus(tx, order.chargeId);
    await tx.auditLog.create({ data: { organizationId: order.organizationId, action: "PESAPAL_PAYMENT_VERIFIED", entityType: "Payment", entityId: payment.id, metadata: { requestId: order.id, trackingId, receiptNumber, amount: Number(order.amount), currency: order.currency } } });
    return { status: "COMPLETED", paymentId: payment.id };
  });
}
