import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { paymentReceiptIntegrityHash } from "@/lib/payment-receipt-integrity";
import { paymentAmountCorrectionPreview } from "@/lib/payment-correction-preview";
import { refreshChargeStatus } from "@/lib/payment-balance";

/**
 * An internal correction supersedes a posted payment; it never requests a refund,
 * destroys a receipt, or creates new income. The two postings and audit events
 * commit together, so a failure cannot leave a temporarily wrong student balance.
 */
export async function correctRecordedPaymentAmount(
  database: PrismaClient,
  session: SessionPayload,
  input: {
    paymentId: string;
    originalAmount: number;
    correctedAmount: number;
    reason: string;
  },
) {
  return database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR UPDATE`;
    const actor = await tx.user.findFirst({
      where: {
        id: session.userId, organizationId: session.organizationId, active: true,
        sessionVersion: session.sessionVersion, role: {in: ["OWNER", "ADMIN"]},
      },
      select: {id: true},
    });
    if (!actor) throw Error("CORRECTION_NOT_AUTHORIZED");

    const original = await tx.payment.findFirst({
      where: {id: input.paymentId, organizationId: session.organizationId},
      include: {mpesaTransaction: true, rentPaymentRequest: {select:{id:true}}},
    });
    if (!original) throw Error("PAYMENT_NOT_FOUND");
    if (original.reversedAt) throw Error("PAYMENT_ALREADY_REVERSED");
    if (Number(original.amount) !== input.originalAmount) throw Error("PAYMENT_CHANGED");
    if (original.rentPaymentRequest) throw Error("GATEWAY_VERIFIED_PAYMENT");
    if (original.mpesaTransaction) throw Error("IMPORTED_MPESA_REVIEW");

    await tx.$queryRaw`SELECT id FROM "SemesterCharge" WHERE id=${original.chargeId} AND "organizationId"=${session.organizationId} FOR UPDATE`;
    const charge = await tx.charge.findFirst({
      where: {id: original.chargeId, organizationId: session.organizationId},
      include: {payments: {where: {reversedAt: null}, select: {amount: true}}},
    });
    if (!charge || charge.studentId !== original.studentId ||
        original.currency !== charge.currency || charge.status === "WAIVED") {
      throw Error("CHARGE_CHANGED");
    }
    if (original.method === "MPESA" && original.reference) {
      const collision = await tx.payment.findFirst({
        where: {
          organizationId: session.organizationId, method: "MPESA",
          reference: {equals: original.reference, mode: "insensitive"},
          reversedAt: null, id: {not: original.id},
        },
        select: {id: true},
      });
      if (collision) throw Error("DUPLICATE_REFERENCE");
      const imported = await tx.mpesaTransaction.findUnique({
        where: {organizationId_transactionCode: {
          organizationId: session.organizationId,
          transactionCode: original.reference.toUpperCase(),
        }},
        select: {id: true},
      });
      if (imported) throw Error("IMPORTED_MPESA_REVIEW");
    }
    const preview = paymentAmountCorrectionPreview({
      currency: charge.currency,
      chargeAmount: Number(charge.amount),
      existingActivePaid: charge.payments.reduce((sum, p) => sum + Number(p.amount), 0),
      oldPaymentAmount: Number(original.amount),
      replacementAmount: input.correctedAmount,
    });
    const reversed = await tx.payment.updateMany({
      where: {id: original.id, organizationId: session.organizationId, reversedAt: null},
      data: {
        reversedAt: new Date(), reversedById: session.userId,
        reversalType: "INTERNAL_CORRECTION",
        reversalReason: `Corrected posted amount from ${original.amount} to ${input.correctedAmount} ${charge.currency}. ${input.reason} No external refund or new money received.`,
      },
    });
    if (reversed.count !== 1) throw Error("PAYMENT_ALREADY_REVERSED");

    const year = original.paidAt.getUTCFullYear();
    const organization = await tx.organization.findUnique({
      where: {id: session.organizationId}, select: {receiptPrefix: true},
    });
    if (!organization) throw Error("ORGANIZATION_NOT_FOUND");
    const seq = await tx.receiptSequence.upsert({
      where: {organizationId_year: {organizationId: session.organizationId, year}},
      create: {organizationId: session.organizationId, year, lastIssued: 1},
      update: {lastIssued: {increment: 1}},
    });
    const receiptNumber = `${organization.receiptPrefix}-${year}-${String(seq.lastIssued).padStart(5,"0")}`;
    const securityReference = `SH-${randomBytes(16).toString("hex").toUpperCase()}`;
    const issuedAt = new Date();
    const paidAt = original.paidAt.toISOString().slice(0, 10);
    const integrityHash = paymentReceiptIntegrityHash({
      organizationId: session.organizationId,
      studentId: original.studentId,
      chargeId: charge.id,
      receiptNumber,
      securityReference,
      currency: charge.currency,
      amount: input.correctedAmount,
      paidAt,
      method: original.method,
      reference: original.reference,
      issuedAt,
    });
    const replacement = await tx.payment.create({
      data: {
        organizationId: session.organizationId,
        studentId: original.studentId,
        chargeId: charge.id,
        recordedById: session.userId,
        currency: original.currency,
        amount: input.correctedAmount,
        paidAt: original.paidAt,
        method: original.method,
        reference: original.reference,
        receiptNumber, securityReference, integrityHash, issuedAt,
        notes: `Internal correction of receipt ${original.receiptNumber}. ${input.reason}. Existing funds; no new collection.`,
      },
    });
    await refreshChargeStatus(tx, charge.id);
    await tx.auditLog.createMany({
      data: [
        {
          organizationId: session.organizationId, actorUserId: session.userId,
          action: "PAYMENT_REVERSED_INTERNAL", entityType: "Payment", entityId: original.id,
          metadata: {
            amount: Number(original.amount), receiptNumber: original.receiptNumber,
            replacementReceiptNumber: receiptNumber, replacementPaymentId: replacement.id,
            reversalType: "INTERNAL_CORRECTION", reason: input.reason,
            externalRefund: false,
          },
        },
        {
          organizationId: session.organizationId, actorUserId: session.userId,
          action: "PAYMENT_RECORDED_INTERNAL_CORRECTION", entityType: "Payment", entityId: replacement.id,
          metadata: {
            originalPaymentId: original.id, originalReceiptNumber: original.receiptNumber,
            replacementReceiptNumber: receiptNumber, correctedAmount: input.correctedAmount,
            currency: charge.currency, reason: input.reason,
            securityReference, integrityHash, chargeId: charge.id,
            paidAfter: preview.paidAfter, balanceAfter: preview.balanceAfter,
            newCashReceived: false,
          },
        },
      ],
    });
    return {
      paymentId: replacement.id, originalPaymentId: original.id, chargeId: charge.id,
      receiptNumber, ...preview,
    };
  }, {isolationLevel: "Serializable"});
}
