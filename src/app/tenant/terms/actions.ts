"use server";
import { getTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { signStudentTerms } from "@/lib/hostel-terms/service";
import { revalidatePath } from "next/cache";
export type TermsSignState = { error?: string; id?: string };
export async function signTermsAction(_state: TermsSignState, form: FormData): Promise<TermsSignState> {
  try {
    const result = await signStudentTerms(db, await getTenantSession(), { version: form.get("version"), documentHash: form.get("documentHash"), occupancyId: form.get("occupancyId"), signatureName: form.get("signatureName"), agree: form.get("agree") });
    if ("id" in result && result.id) { revalidatePath("/tenant/terms"); revalidatePath("/student-terms"); }
    return result;
  } catch { return { error: "The terms could not be saved. Please try again. Your account and rent charges have not been changed." }; }
}
