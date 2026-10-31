import { db } from "@/lib/db";
import { verifyRentRequest } from "@/lib/rent-payments";
import { validTrackingId } from "@/lib/pesapal-api";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  let data;
  try { const body = await request.text(); if (body.length > 2048) return new Response("Invalid notification", { status: 400 }); data = JSON.parse(body); } catch { return new Response("Invalid notification", { status: 400 }); }
  if (data.OrderNotificationType !== "IPNCHANGE" || !validTrackingId(data.OrderTrackingId) || typeof data.OrderMerchantReference !== "string" || !/^R-[a-f0-9-]{36}$/.test(data.OrderMerchantReference)) return new Response("Invalid notification", { status: 400 });
  try {
    // The webhook is a hint, never evidence of payment. Always query Pesapal.
    await verifyRentRequest(db, data.OrderMerchantReference, data.OrderTrackingId);
    return Response.json({ orderNotificationType: "IPNCHANGE", orderTrackingId: data.OrderTrackingId, orderMerchantReference: data.OrderMerchantReference, status: 200 }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ status: 500 }, { status: 503 }); }
}
