import { runLateFees } from "@/lib/late-fees";
import { runArrearsAutomation } from "@/lib/arrears-reminders";
import { prunePasswordRecovery } from "@/lib/password-recovery";
import { NextResponse } from "next/server";
import { runPortalInvitations } from "@/lib/portal-invitations";
import { sendCommunicationEmails } from "@/lib/communication-email";
import { runCommunications } from "@/lib/communications";
import { runHealthfixMaintenance } from "@/lib/healthfix";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await prunePasswordRecovery(db);
  const healthfix = await runHealthfixMaintenance(db);
  const lateFees = await runLateFees(db);
  const arrears = await runArrearsAutomation(db);
  const communications = await runCommunications(db);
  const email = await sendCommunicationEmails(db);
  const invitations = await runPortalInvitations(db);
  return NextResponse.json({ ok: true, queued: communications.queued, communications, email, invitations, healthfix, arrears, lateFees });
}
