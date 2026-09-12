import { verifyReceiptShareToken } from "@/lib/receipt-share-token";
import { sharedReceiptPdfResponse } from "@/lib/shared-receipt-pdf";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const receipt = await verifyReceiptShareToken(token);
  if (!receipt) return new Response("This receipt link is invalid or has expired.", { status: 401, headers: { "Cache-Control": "no-store" } });
  return sharedReceiptPdfResponse(receipt.paymentId, receipt.organizationId);
}
