"use server";
import { redirect } from "next/navigation";
import { requireSession, deleteSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { updateOwnAccount, type AccountSecurityState } from "@/lib/account-security";
export async function updateAccountAction(_state: AccountSecurityState, form: FormData): Promise<AccountSecurityState> {
  const session = await requireSession();
  const result = await updateOwnAccount(db, session, { ...Object.fromEntries(["operation", "currentPassword", "email", "confirmEmail", "password", "confirmPassword"].map(name => [name, form.get(name)])), confirmSignOut: form.get("confirmSignOut") === "on" });
  if (!result.success) return { error: result.error };
  try { await deleteSession(); } catch { /* Existing sessions are already revoked in the database. */ }
  redirect("/login?accountUpdated=1");
}
