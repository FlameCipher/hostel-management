"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export type ReminderState = { error: string };
const schema = z.object({ studentId: z.string().min(1), recipientType: z.enum(["STUDENT", "GUARDIAN"]), channel: z.enum(["WHATSAPP", "SMS"]), message: z.string().trim().min(10).max(1000) });

export async function createReminderAction(_state: ReminderState, formData: FormData): Promise<ReminderState> {
  const session = await requireSession();
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

export async function openReminderAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("notificationId") ?? "");
  const item = await db.notification.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!item) return;
  await db.notification.update({ where: { id }, data: { status: "OPENED_FOR_SENDING", openedAt: new Date() } });
  const digits = item.recipientPhone.replace(/\D/g, "").replace(/^0/, "254");
  redirect(item.channel === "WHATSAPP" ? `https://wa.me/${digits}?text=${encodeURIComponent(item.message)}` : `sms:${item.recipientPhone}?body=${encodeURIComponent(item.message)}`);
}

export async function markReminderSentAction(formData: FormData) {
  const session = await requireSession();
  await db.notification.updateMany({ where: { id: String(formData.get("notificationId") ?? ""), organizationId: session.organizationId }, data: { status: "SENT", sentAt: new Date() } });
  revalidatePath("/notifications");
}

export async function cancelReminderAction(formData: FormData) {
  const session = await requireSession();
  await db.notification.updateMany({ where: { id: String(formData.get("notificationId") ?? ""), organizationId: session.organizationId, status: { not: "SENT" } }, data: { status: "CANCELLED" } });
  revalidatePath("/notifications");
}
