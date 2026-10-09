"use server";
import { db } from "@/lib/db";
import { requestPropertyContext } from "@/lib/property-host";
import { getPublicLookupFingerprint } from "@/lib/student-update-session";
import { submitTenantRegistration, reviewTenantRegistration } from "@/lib/tenant-registration";
import { requireSession } from "@/lib/auth/session";
import type { ResidentState } from "@/app/tenant/visitors/actions";
import { revalidatePath } from "next/cache";
export async function registerTenantAction(_s: ResidentState, f: FormData): Promise<ResidentState> {
  const context = await requestPropertyContext();
  if (!context.property || f.get("website")) return { error: "Open your hostel website to register your existing tenancy." };
  try {
    const result = await submitTenantRegistration(db, context.property.id, { ...Object.fromEntries(f), consent: f.get("consent") === "on" }, f.get("ticket"), await getPublicLookupFingerprint());
    revalidatePath("/students/registrations"); return result;
  } catch { return { error: "Registration could not be confirmed. Contact management before submitting again." }; }
}
export async function reviewRegistrationAction(_s: ResidentState, f: FormData): Promise<ResidentState> {
  const session = await requireSession();
  try {
    const result = await reviewTenantRegistration(db, session, { id: f.get("id"), studentId: f.get("studentId") ?? "", approve: f.get("decision") === "APPROVE", verified: f.get("verified") === "on" });
    for (const path of ["/students/registrations", "/students", "/dashboard", "/assistant"]) revalidatePath(path);
    return result;
  } catch { return { error: "Could not confirm this review. Refresh before retrying." }; }
}
