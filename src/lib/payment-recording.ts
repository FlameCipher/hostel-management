import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient, PaymentMethod } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { validAmount, minorUnits, currencyDigits, formatMoney } from "@/lib/currency";

export type PaymentInput = {
 currency: string; chargeId: string; amount: number; paidAt: string; method: PaymentMethod;
 reference?: string; nextBalanceDueDate?: string; notes?: string;
};

/** Authenticated manual ledger entry; never initiates collection or sends a message. */
export async function recordPayment(database: PrismaClient, session: SessionPayload, input: PaymentInput) {
 const currency = input.currency;
 let paymentId = "";
 let requiresRoomAllocation = false;
    await database.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR UPDATE`;
      const actor = await tx.user.findFirst({where:{id:session.userId,organizationId:session.organizationId,active:true,sessionVersion:session.sessionVersion,role:{in:["OWNER","ADMIN","MANAGER"]}}});
      if (!actor) throw new Error("FINANCE_ACCESS_DENIED");
      await tx.$queryRaw`SELECT id FROM "SemesterCharge" WHERE id=${input.chargeId} AND "organizationId"=${session.organizationId} FOR UPDATE`;
      const charge = await tx.charge.findFirst({ where: { id: input.chargeId, organizationId: session.organizationId }, include: { semester: { select: { status: true } }, payments: { where: { reversedAt: null }, select: { amount: true } } } });
      if (!charge) throw new Error("CHARGE_NOT_FOUND");
      if (input.method === "MPESA" && input.reference) {
        const duplicateReference = await tx.payment.findFirst({ where: { organizationId: session.organizationId, method: "MPESA", reference: { equals: input.reference, mode: "insensitive" }, reversedAt: null } });
        if (duplicateReference) throw new Error(`DUPLICATE_REFERENCE:${duplicateReference.receiptNumber}`);
      }
      if (charge.currency !== currency) throw new Error("CURRENCY_MISMATCH");
      if (!validAmount(input.amount, currency) || input.amount <= 0) throw new Error("INVALID_CURRENCY_AMOUNT");
      const amountPaid = charge.payments.reduce((sum, item) => sum + minorUnits(Number(item.amount), currency), 0);
      const balanceMinor = minorUnits(Number(charge.amount), currency) - amountPaid;
      const balance = balanceMinor / 10 ** currencyDigits(currency);
      if (balance <= 0) throw new Error("CHARGE_PAID");
      if (minorUnits(input.amount, currency) > balanceMinor) throw new Error(`OVERPAY:${balance}`);

      const year = new Date(`${input.paidAt}T12:00:00.000Z`).getUTCFullYear();
      const organization = await tx.organization.findUnique({ where: { id: session.organizationId }, select: { receiptPrefix: true } });
      if (!organization) throw new Error("ORGANIZATION_NOT_FOUND");
      const sequence = await tx.receiptSequence.upsert({
        where: { organizationId_year: { organizationId: session.organizationId, year } },
        create: { organizationId: session.organizationId, year, lastIssued: 1 },
        update: { lastIssued: { increment: 1 } },
      });
      const receiptNumber = `${organization.receiptPrefix}-${year}-${String(sequence.lastIssued).padStart(5, "0")}`;
      const normalizedReference = input.method === "MPESA" ? input.reference?.toUpperCase() : input.reference;
      const securityReference = `SH-${randomBytes(16).toString("hex").toUpperCase()}`;
      const issuedAt = new Date();
      const integrityPayload = [session.organizationId, charge.studentId, charge.id, receiptNumber, securityReference, currency, input.amount.toFixed(currencyDigits(currency)), input.paidAt, input.method, normalizedReference || "", issuedAt.toISOString()].join("|");
      const integrityHash = createHash("sha256").update(integrityPayload).digest("hex");
      const payment = await tx.payment.create({ data: { currency, organizationId: session.organizationId, studentId: charge.studentId, chargeId: charge.id, recordedById: session.userId, amount: input.amount, paidAt: new Date(`${input.paidAt}T12:00:00.000Z`), method: input.method, reference: normalizedReference || null, receiptNumber, securityReference, integrityHash, issuedAt, notes: input.notes || null } });
      paymentId = payment.id;
      requiresRoomAllocation = charge.type === "SEMESTER_RENT" && !charge.occupancyId && charge.semester?.status === "ACTIVE";
      if (input.method === "MPESA" && normalizedReference) {
        const imported = await tx.mpesaTransaction.findUnique({ where: { organizationId_transactionCode: { organizationId: session.organizationId, transactionCode: normalizedReference } } });
        if (imported && !imported.paymentId) {
          const exact = imported.currency === currency && Number(imported.amount) === input.amount;
          await tx.mpesaTransaction.update({ where: { id: imported.id }, data: exact ? { paymentId: payment.id, status: "MATCHED", matchedAt: new Date(), notes: null } : { status: "AMOUNT_MISMATCH", notes: `Reference matches ${receiptNumber}, but payment amount is ${formatMoney(input.amount, currency)}.` } });
        }
      }
      const newBalance = (balanceMinor - minorUnits(input.amount, currency)) / 10 ** currencyDigits(currency);
      const dueDate = newBalance > 0 && input.nextBalanceDueDate ? new Date(`${input.nextBalanceDueDate}T12:00:00.000Z`) : charge.dueDate;
      const status = newBalance <= 0 ? "FULLY_PAID" : dueDate < new Date() ? "OVERDUE" : "PARTIALLY_PAID";
      await tx.charge.update({ where: { id: charge.id }, data: { status, dueDate } });
      await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "PAYMENT_RECORDED", entityType: "Payment", entityId: payment.id, metadata: { receiptNumber, securityReference, integrityHash, currency, amount: input.amount, chargeId: charge.id } } });
    });
 return {paymentId, requiresRoomAllocation};
}
