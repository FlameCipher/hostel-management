"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { requestArrears, setArrearsAutomation, type ArrearsResult } from "@/lib/arrears-reminders";
import { savePaymentAgreement } from "@/lib/payment-agreements";
import { actOnManualNotification } from "@/lib/whatsapp-communications";

function refresh() { revalidatePath("/reports/arrears"); revalidatePath("/tenant/messages"); revalidatePath("/communications"); revalidatePath("/notifications"); }
export async function sendArrearsAction(_state: ArrearsResult, form: FormData): Promise<ArrearsResult> {
  const session = await requireSession();
  try {
    const result = await requestArrears(db, session, { requestId: form.get("requestId"), recipients: JSON.parse(String(form.get("recipients") ?? "[]")), whatsapp: form.get("whatsapp") === "on", email: form.get("email") === "on" });
    refresh(); return result;
  } catch { return { error: "The requests could not be confirmed. Refresh and check the delivery history before retrying." }; }
}
export async function forwardArrearsAction(studentId: string, fingerprint: string, requestId: string) {
  const session = await requireSession();
  let result: ArrearsResult;
  try {
    result = await requestArrears(db, session, { requestId, recipients: [{ studentId, fingerprint }], whatsapp: true, email: false, manual: true });
  } catch { result = { error: "Could not prepare the WhatsApp message. Refresh and try again." }; }
  if (result.notificationId) {
    const opened = await actOnManualNotification(db, session, result.notificationId, "OPEN");
    refresh();
    if (opened.url) redirect(opened.url);
    result = opened;
  }
  refresh();
  redirect(`/reports/arrears?error=${encodeURIComponent(result.error ?? "A request already exists for today. Check its delivery status in the WhatsApp centre.")}`);
}
export async function arrearsAutomationAction(_state: ArrearsResult, form: FormData): Promise<ArrearsResult> {
  const session = await requireSession();
  try {
    const result = await setArrearsAutomation(db, session, { enabled: form.get("enabled") === "on", whatsapp: form.get("whatsapp") === "on", email: form.get("email") === "on" });
    refresh(); return result;
  } catch { return { error: "Could not save the automatic reminder settings. Please try again." }; }
}

export async function paymentAgreementAction(_state: ArrearsResult, form: FormData): Promise<ArrearsResult> {
  const session = await requireSession();
  try {
    const result = await savePaymentAgreement(db, session, { studentId: String(form.get("studentId") ?? ""), date: String(form.get("date") ?? ""), note: String(form.get("note") ?? ""), expectedUpdatedAt: String(form.get("expectedUpdatedAt") ?? ""), clear: form.get("operation") === "clear", confirmed: form.get("confirmed") === "on" });
    refresh(); return result;
  } catch { return { error: "The agreement could not be saved. Refresh before trying again." }; }
}
