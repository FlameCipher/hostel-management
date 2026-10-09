"use server";
import { after } from "next/server";
import { requestPropertyContext } from "@/lib/property-host";
import { db } from "@/lib/db";
import { requestPasswordRecovery, type RecoveryState } from "@/lib/password-recovery";
export async function requestRecoveryAction(_state: RecoveryState, form: FormData): Promise<RecoveryState> {
  const context = await requestPropertyContext();
  return requestPasswordRecovery(db, { kind: form.get("kind"), identifier: form.get("identifier"), hostel: String(form.get("hostel") ?? "") }, context.host, undefined, undefined, undefined, after);
}
