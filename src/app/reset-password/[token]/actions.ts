"use server";
import { redirect } from "next/navigation";
import { requestPropertyContext } from "@/lib/property-host";
import { db } from "@/lib/db";
import { resetRecoveredPassword, type RecoveryState } from "@/lib/password-recovery";
import { deleteSession } from "@/lib/auth/session";
import { deleteTenantSession } from "@/lib/auth/tenant-session";
export async function resetRecoveryAction(_state: RecoveryState, form: FormData): Promise<RecoveryState> {
  const context = await requestPropertyContext();
  const result = await resetRecoveredPassword(db, { token: form.get("token"), password: form.get("password"), confirmation: form.get("confirmation") }, context.host);
  if (result.complete) { await deleteSession(); await deleteTenantSession(); redirect(result.kind === "TENANT" ? "/tenant/login?passwordReset=1" : "/login?passwordReset=1"); }
  return result;
}
