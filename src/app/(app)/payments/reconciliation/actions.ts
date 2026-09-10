"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";

export type ImportState = { error: string; message: string };

async function requireReconciliationAccess() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/payments");
  return session;
}

const aliases: Record<string, string> = {
  transactioncode: "transactionCode", transactionid: "transactionCode", receiptno: "transactionCode", receipt: "transactionCode",
  phone: "phone", phonenumber: "phone", msisdn: "phone",
  amount: "amount", paidin: "amount",
  transactedat: "transactedAt", date: "transactedAt", completiontime: "transactedAt", transactiondate: "transactedAt",
  reference: "reference", accountreference: "reference", account: "reference",
};

const normalizeHeader = (value: string) => aliases[value.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? "";

export async function importMpesaStatementAction(_state: ImportState, formData: FormData): Promise<ImportState> {
  const session = await requireReconciliationAccess();
  const file = formData.get("statement");
  if (!(file instanceof File) || !file.size) return { error: "Select an M-Pesa CSV statement.", message: "" };
  if (file.size > 2_000_000) return { error: "The CSV must be smaller than 2 MB.", message: "" };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "The CSV has no transaction rows.", message: "" };
  const headers = rows[0].map(normalizeHeader);
  const required = ["transactionCode", "amount", "transactedAt"];
  if (required.some((header) => !headers.includes(header))) return { error: "CSV requires transactionCode, amount and transactedAt columns.", message: "" };

  let imported = 0; let matched = 0; let mismatched = 0; let duplicates = 0; let invalid = 0;
  for (const values of rows.slice(1)) {
    const data = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]).filter(([header]) => header));
    const code = String(data.transactionCode ?? "").trim().toUpperCase();
    const amount = Number(String(data.amount ?? "").replace(/[^0-9.-]/g, ""));
    const transactedAt = new Date(String(data.transactedAt ?? ""));
    if (!code || !Number.isFinite(amount) || amount <= 0 || Number.isNaN(transactedAt.getTime())) { invalid += 1; continue; }

    const existing = await db.mpesaTransaction.findUnique({ where: { organizationId_transactionCode: { organizationId: session.organizationId, transactionCode: code } } });
    if (existing) { duplicates += 1; continue; }
    const payment = await db.payment.findFirst({
      where: { organizationId: session.organizationId, method: "MPESA", reference: { equals: code, mode: "insensitive" }, reversedAt: null, mpesaTransaction: null },
    });
    const exact = payment && Number(payment.amount) === amount;
    const status = exact ? "MATCHED" : payment ? "AMOUNT_MISMATCH" : "UNMATCHED";
    await db.$transaction(async (tx) => {
      const transaction = await tx.mpesaTransaction.create({ data: {
        organizationId: session.organizationId,
        paymentId: exact ? payment.id : null,
        transactionCode: code,
        phone: String(data.phone ?? "").trim() || null,
        amount,
        transactedAt,
        reference: String(data.reference ?? "").trim() || null,
        status,
        matchedAt: exact ? new Date() : null,
        notes: payment && !exact ? `Reference matches ${payment.receiptNumber}, but payment amount is KES ${Number(payment.amount).toLocaleString("en-KE")}.` : null,
        rawData: data,
      } });
      await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: exact ? "MPESA_AUTO_MATCHED" : "MPESA_IMPORTED", entityType: "MpesaTransaction", entityId: transaction.id, metadata: { transactionCode: code, amount, status } } });
    });
    imported += 1; if (exact) matched += 1; if (payment && !exact) mismatched += 1;
  }
  revalidatePath("/payments/reconciliation");
  return { error: "", message: `Imported ${imported}; auto-matched ${matched}; amount mismatches ${mismatched}; duplicates skipped ${duplicates}; invalid skipped ${invalid}.` };
}

const matchSchema = z.object({ transactionId: z.string().min(1), paymentId: z.string().min(1) });
export async function matchMpesaPaymentAction(formData: FormData) {
  const session = await requireReconciliationAccess();
  const parsed = matchSchema.safeParse({ transactionId: formData.get("transactionId"), paymentId: formData.get("paymentId") });
  if (!parsed.success) redirect("/payments/reconciliation?error=Select+a+payment+to+match.");
  try {
    await db.$transaction(async (tx) => {
      const [transaction, payment] = await Promise.all([
        tx.mpesaTransaction.findFirst({ where: { id: parsed.data.transactionId, organizationId: session.organizationId } }),
        tx.payment.findFirst({ where: { id: parsed.data.paymentId, organizationId: session.organizationId, method: "MPESA", reversedAt: null }, include: { mpesaTransaction: true } }),
      ]);
      if (!transaction || !payment) throw new Error("NOT_FOUND");
      if (transaction.paymentId || payment.mpesaTransaction) throw new Error("ALREADY_MATCHED");
      if (Number(transaction.amount) !== Number(payment.amount)) throw new Error("AMOUNT_MISMATCH");
      await tx.mpesaTransaction.update({ where: { id: transaction.id }, data: { paymentId: payment.id, status: "MATCHED", matchedAt: new Date(), notes: null } });
      await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "MPESA_MANUALLY_MATCHED", entityType: "MpesaTransaction", entityId: transaction.id, metadata: { paymentId: payment.id, receiptNumber: payment.receiptNumber } } });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const text = message === "AMOUNT_MISMATCH" ? "Amounts+must+match+before+reconciliation." : message === "ALREADY_MATCHED" ? "The+transaction+or+payment+is+already+matched." : "The+match+could+not+be+completed.";
    redirect(`/payments/reconciliation?error=${text}`);
  }
  revalidatePath("/payments/reconciliation");
  redirect("/payments/reconciliation?matched=1");
}

export async function ignoreMpesaTransactionAction(formData: FormData) {
  const session = await requireReconciliationAccess();
  const id = String(formData.get("transactionId") ?? "");
  const transaction = await db.mpesaTransaction.findFirst({ where: { id, organizationId: session.organizationId, paymentId: null } });
  if (transaction) {
    await db.mpesaTransaction.update({ where: { id }, data: { status: "IGNORED", notes: "Marked as not belonging to this hostel ledger." } });
    await db.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "MPESA_IGNORED", entityType: "MpesaTransaction", entityId: id } });
  }
  revalidatePath("/payments/reconciliation");
}
