"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { communicationManager } from "@/lib/communications";
import { actOnManualNotification } from "@/lib/whatsapp-communications";

export type ReminderState = { error: string };
const schema = z.object({ studentId: z.string().min(1), recipientType: z.enum(["STUDENT", "GUARDIAN"]), channel: z.enum(["WHATSAPP", "SMS"]), message: z.string().trim().min(10).max(1000) });

export async function createReminderAction(_state: ReminderState, formData: FormData): Promise<ReminderState> {
  const session = await requireSession();
  if (!await communicationManager(db, session)) return { error: "Only active management can prepare reminders." };
  const parsed = schema.safeParse({ studentId: formData.get("studentId"), recipientType: formData.get("recipientType"), channel: formData.get("channel"), message: formData.get("message") });
  if (!parsed.success) return { error: "Select a recipient and enter a message of at least 10 characters." };
  const [student, organization] = await Promise.all([
    db.student.findFirst({ where: { id: parsed.data.studentId, organizationId: session.organizationId }, include: { guardian: true } }),
    db.organization.findUnique({ where: { id: session.organizationId }, select: { whatsappEnabled: true, smsEnabled: true } }),
  ]);
  if (!student || !organization) return { error: "Student or organization settings could not be found." };
  if (parsed.data.channel === "WHATSAPP" && !organization.whatsappEnabled) return { error: "WhatsApp reminders are disabled in Settings." };
  if (parsed.data.channel === "SMS" && !organization.smsEnabled) return { error: "SMS reminders are disabled in Settings." };
  const target = parsed.data.recipientType === "GUARDIAN" ? student.guardian : null;
  if (parsed.data.recipientType === "GUARDIAN" && !target) return { error: "This student has no guardian contact." };
  await db.notification.create({ data: { organizationId: session.organizationId, studentId: student.id, createdById: session.userId, channel: parsed.data.channel, recipientType: parsed.data.recipientType, recipientName: target?.name ?? student.fullName, recipientPhone: target?.phone ?? student.phone, message: parsed.data.message, status: "QUEUED" } });
  revalidatePath("/notifications"); redirect("/notifications");
}

async function updateReminder(formData: FormData, action: "OPEN" | "SENT" | "CANCEL") {
  const session = await requireSession();
  const result = await actOnManualNotification(db, session, String(formData.get("notificationId") ?? ""), action);
  revalidatePath("/notifications"); revalidatePath("/communications/whatsapp");
  if (result.url) redirect(result.url);
  if (result.error) redirect(`/notifications?error=${encodeURIComponent(result.error)}`);
}
export async function openReminderAction(formData: FormData) { await updateReminder(formData, "OPEN"); }
export async function markReminderSentAction(formData: FormData) { await updateReminder(formData, "SENT"); }
export async function cancelReminderAction(formData: FormData) { await updateReminder(formData, "CANCEL"); }
