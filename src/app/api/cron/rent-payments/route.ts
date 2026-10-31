import { db } from "@/lib/db";
import { healthfixAuthorized } from "@/lib/healthfix";
import { reconcileRentRequests } from "@/lib/rent-payments";
import { deliverPaymentReceipt } from "@/lib/receipt-delivery";
import { RENT_ORGANIZATION } from "@/lib/pesapal-api";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request) {
  if (!healthfixAuthorized(process.env.CRON_SECRET, request.headers.get("authorization")?.replace(/^Bearer /, "") ?? null)) return new Response("Unauthorized", { status: 401 });
  if (process.env.VERCEL_ENV !== "production") return Response.json({ checked: 0 });
  const result = await reconcileRentRequests(db);
  const pending = await db.payment.findMany({ where: { organizationId: RENT_ORGANIZATION, reversedAt: null, rentPaymentRequest: { status: "COMPLETED" }, student: { email: { not: null } }, receiptDeliveryStatus: { in: ["PENDING", "FAILED", "ACTION_REQUIRED"] }, updatedAt: { lt: new Date(Date.now() - 300_000) } }, orderBy: { updatedAt: "asc" }, select: { id: true, organizationId: true }, take: 10 });
  await Promise.all(pending.map(payment => deliverPaymentReceipt(payment.id, payment.organizationId)));
  return Response.json({ ...result, receiptsChecked: pending.length }, { headers: { "Cache-Control": "no-store" } });
}
