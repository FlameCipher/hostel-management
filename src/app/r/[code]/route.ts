import { db } from "@/lib/db";
import { receiptCodeHash } from "@/lib/short-receipt-link";
import { sharedReceiptPdfResponse } from "@/lib/shared-receipt-pdf";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const unavailable = () => new Response("This receipt link is invalid or has expired.", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!/^[A-Za-z0-9_-]{22}$/.test(code)) return unavailable();
  const receipt = await db.paymentReceiptLink.findUnique({ where: { codeHash: receiptCodeHash(code) }, select: { expiresAt: true, paymentId: true, payment: { select: { organizationId: true } } } });
  if (!receipt || receipt.expiresAt <= new Date()) return unavailable();
  return sharedReceiptPdfResponse(receipt.paymentId, receipt.payment.organizationId);
}
