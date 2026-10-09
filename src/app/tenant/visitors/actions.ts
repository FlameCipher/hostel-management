"use server";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { requestVisit, updateVisit } from "@/lib/visitors";
import { revalidatePath } from "next/cache";
export type ResidentState = { error?: string; success?: string };
function refresh() { for (const path of ["/tenant/visitors", "/visitors", "/dashboard", "/assistant", "/tenant/assistant"]) revalidatePath(path); }
export async function requestVisitAction(_s: ResidentState, f: FormData): Promise<ResidentState> {
  const session = await requireTenantSession();
  try { const result = await requestVisit(db, session, Object.fromEntries(f)); refresh(); return result; } catch { return { error: "Could not confirm your request. Refresh the visitor list before retrying." }; }
}
export async function gateVisitAction(_s: ResidentState, f: FormData): Promise<ResidentState> {
  const session = await requireSession();
  try { const result = await updateVisit(db, session, { id: f.get("id"), action: f.get("decision"), verified: f.get("verified") === "on", note: f.get("note") ?? "" }); refresh(); return result; } catch { return { error: "Could not confirm the gate update. Refresh before retrying." }; }
}
export async function cancelVisitAction(_s: ResidentState, f: FormData): Promise<ResidentState> {
  const session = await requireTenantSession();
  try { const result = await updateVisit(db, session, { id: f.get("id"), action: "CANCEL", verified: false, note: "" }, true); refresh(); return result; } catch { return { error: "Could not confirm cancellation. Refresh before retrying." }; }
}
