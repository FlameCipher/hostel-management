import { NextResponse } from "next/server";
import { queueDuePaymentReminders } from "@/lib/payment-reminders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const queued = await queueDuePaymentReminders();
  return NextResponse.json({ ok: true, queued });
}
