import { NextResponse } from "next/server";
import { runPortalInvitations } from "@/lib/portal-invitations";
import { sendCommunicationEmails } from "@/lib/communication-email";
import { runCommunications } from "@/lib/communications";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const communications = await runCommunications(db);
  const email = await sendCommunicationEmails(db);
  const invitations = await runPortalInvitations(db);
  return NextResponse.json({ ok: true, queued: communications.queued, communications, email, invitations });
}
