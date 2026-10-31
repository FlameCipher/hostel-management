import { db } from "@/lib/db";
import { verifyRentRequest } from "@/lib/rent-payments";
import { RENT_ORIGIN, validTrackingId } from "@/lib/pesapal-api";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("OrderMerchantReference"), tracking = params.get("OrderTrackingId");
  if (!id || !/^R-[a-f0-9-]{36}$/.test(id) || !validTrackingId(tracking)) return new Response("Invalid payment return", { status: 400 });
  const order = await db.rentPaymentRequest.findUnique({ where: { id } });
  if (!order || (order.trackingId && order.trackingId.toLowerCase() !== tracking.toLowerCase())) return new Response("Payment request not found", { status: 404 });
  try { await verifyRentRequest(db, id, tracking); } catch {
    if (!order.trackingId) return new Response("Payment verification is temporarily unavailable. Do not pay again. Return to your original payment request link shortly.", { status: 503 });
  }
  return new Response(null, { status: 303, headers: { Location: RENT_ORIGIN + "/rent-request/" + order.token, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
