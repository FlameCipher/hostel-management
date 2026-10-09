"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { actOnManualNotification, prepareWhatsAppDrafts, type WhatsAppResult } from "@/lib/whatsapp-communications";

export async function prepareWhatsAppAction(_state: WhatsAppResult, form: FormData): Promise<WhatsAppResult> {
  const session = await requireSession();
  try {
    const result = await prepareWhatsAppDrafts(db, session, { requestId: form.get("requestId"), audience: form.get("audience"), selection: form.get("selection"), recipientIds: form.getAll("recipientIds"), message: form.get("message") });
    revalidatePath("/communications/whatsapp"); revalidatePath("/notifications"); return result;
  } catch { return { error: "Drafts could not be confirmed. Refresh the list before trying again." }; }
}
export async function updateWhatsAppDraftAction(form: FormData) {
  const session = await requireSession(), action = String(form.get("action") ?? "");
  if (!["OPEN", "SENT", "FAILED", "CANCEL"].includes(action)) return;
  const result = await actOnManualNotification(db, session, String(form.get("id") ?? ""), action as "OPEN" | "SENT" | "FAILED" | "CANCEL", String(form.get("reason") ?? ""));
  revalidatePath("/communications/whatsapp"); revalidatePath("/notifications");
  if (result.url) redirect(result.url);
  if (result.error) redirect(`/communications/whatsapp?error=${encodeURIComponent(result.error)}`);
}
