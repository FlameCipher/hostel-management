import { createHash } from "node:crypto";
import { currencyDigits } from "@/lib/currency";

/** Receipt v1 integrity: keep this byte-for-byte compatible with existing issued receipts. */
export function paymentReceiptIntegrityHash(input: {
  organizationId: string;
  studentId: string;
  chargeId: string;
  receiptNumber: string;
  securityReference: string;
  currency: string;
  amount: number;
  paidAt: string;
  method: string;
  reference: string | null;
  issuedAt: Date;
}) {
  const fields = [
    input.organizationId,
    input.studentId,
    input.chargeId,
    input.receiptNumber,
    input.securityReference,
    input.currency,
    input.amount.toFixed(currencyDigits(input.currency)),
    input.paidAt,
    input.method,
    input.reference || "",
    input.issuedAt.toISOString(),
  ];
  return createHash("sha256").update(fields.join("|")).digest("hex");
}
