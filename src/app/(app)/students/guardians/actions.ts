"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { applyGuardianFormatCorrection } from "@/lib/guardian-batch-cleanup";

export type GuardianCleanupState = {
  error: string;
  success: string;
};
export const emptyGuardianCleanupState: GuardianCleanupState = { error: "", success: "" };

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "REVIEW_CHANGED") return "Contact details changed since this preview. Refresh the page, review the new list, and confirm again.";
  if (code === "COUNTRY_REVIEW_REQUIRED") return "Hostel country settings must be confirmed before local Kenyan numbers can be converted.";
  if (code === "ACCESS_CHANGED") return "Your management access changed. Sign in again before approving.";
  if (code === "STALE_GUARDIAN") return "A guardian contact was edited during this operation. No partial cleanup was saved; refresh and retry.";
  if (code === "TOO_MANY") return "More contacts than the safe batch limit require cleanup. Review the register before proceeding.";
  return "The update could not be completed safely. No successful cleanup is confirmed; refresh the register and retry.";
}

/** Explicit Owner/Admin approval; no automatic migrations or outbound messages. */
export async function normalizeExistingGuardianPhonesAction(
  _state: GuardianCleanupState,
  form: FormData,
): Promise<GuardianCleanupState> {
  const session = await requireSession();
  if (!["OWNER", "ADMIN"].includes(session.role))
    return {error:"Only the Owner or Admin can approve contact normalization.",success:""};
  if (form.get("confirm") !== "on" ||
      form.get("approvalPhrase") !== "NORMALIZE GUARDIAN CONTACTS") {
    return {error:"Review the preview, tick the confirmation, and enter the approval phrase.",success:""};
  }
  const countValue = Number(form.get("expectedCount"));
  const fingerprint = form.get("fingerprint");
  if (!Number.isSafeInteger(countValue) || countValue < 1 || countValue > 200 ||
      typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(fingerprint)) {
    return {error:"The review preview is missing or invalid. Refresh and review again.",success:""};
  }

  let changed = 0;
  try {
    changed = await applyGuardianFormatCorrection(db, session,
      {count:countValue,fingerprint});
  } catch (error) {
    return {error:errorMessage(error),success:""};
  }

  revalidatePath("/students/guardians");
  revalidatePath("/students");
  revalidatePath("/students/update-requests");
  return {
    error:"",
    success:"Updated " + changed +
      " guardian phone formats with individual audit records. No contacts or payments were added, no messages were sent.",
  };
}
