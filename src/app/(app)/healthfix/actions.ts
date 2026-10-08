"use server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { healthfixManager, repairHealthfix } from "@/lib/healthfix";
import { revalidatePath } from "next/cache";
export type HealthfixState = { error?: string; success?: string };
export async function repairAction(_state: HealthfixState, _form: FormData): Promise<HealthfixState> {
  void _state; void _form;
  const session = await requireSession();
  if (!await healthfixManager(db, session)) return { error: "Only active owners and administrators can run HealthFix repairs." };
  try {
    const result = await repairHealthfix(db, session.organizationId, session);
    revalidatePath("/healthfix");
    return { success: `Completed: ${result.interruptedInvitations} interrupted invitations and ${result.interruptedEmails} interrupted notice emails flagged for review; ${result.expiredInvitations} expired invitation tokens cleared. No emails were sent.` };
  } catch { return { error: "Repair could not be confirmed. Refresh the report and repair history before trying again." }; }
}
