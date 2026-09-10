"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export type SettingsFormState = { error: string; message: string };

async function requireSettingsManager() {
  const session = await requireSession();
  return session.role === "OWNER" || session.role === "ADMIN" ? session : null;
}

const phone = z.string().trim().regex(/^\+?[0-9][0-9\s-]{8,19}$/, "Enter a valid hostel phone number.");
const profileSchema = z.object({
  name: z.string().trim().min(3).max(120), ownerName: z.string().trim().min(2).max(120), phone,
  email: z.union([z.literal(""), z.string().trim().email()]), physicalAddress: z.string().trim().max(240),
  receiptPrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/, "Receipt prefix must be 2–8 letters or numbers."),
  defaultSemesterMonths: z.coerce.number().int().min(1).max(12), defaultBreakMonths: z.coerce.number().int().min(1).max(12),
  reminderDaysBefore: z.coerce.number().int().min(0).max(90), mpesaShortcode: z.string().trim().max(20), mpesaAccountName: z.string().trim().max(120),
});

export async function updateOrganizationSettingsAction(_state: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const session = await requireSettingsManager();
  if (!session) return { error: "Only the Owner or an Admin can change settings.", message: "" };
  const parsed = profileSchema.safeParse({ name: formData.get("name"), ownerName: formData.get("ownerName"), phone: formData.get("phone"), email: formData.get("email"), physicalAddress: formData.get("physicalAddress"), receiptPrefix: formData.get("receiptPrefix"), defaultSemesterMonths: formData.get("defaultSemesterMonths"), defaultBreakMonths: formData.get("defaultBreakMonths"), reminderDaysBefore: formData.get("reminderDaysBefore"), mpesaShortcode: formData.get("mpesaShortcode"), mpesaAccountName: formData.get("mpesaAccountName") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the settings.", message: "" };
  await db.$transaction([
    db.organization.update({ where: { id: session.organizationId }, data: { ...parsed.data, email: parsed.data.email || null, physicalAddress: parsed.data.physicalAddress || null, mpesaShortcode: parsed.data.mpesaShortcode || null, mpesaAccountName: parsed.data.mpesaAccountName || null, whatsappEnabled: formData.get("whatsappEnabled") === "on", smsEnabled: formData.get("smsEnabled") === "on" } }),
    db.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "ORGANIZATION_SETTINGS_UPDATED", entityType: "Organization", entityId: session.organizationId, metadata: { receiptPrefix: parsed.data.receiptPrefix, defaultSemesterMonths: parsed.data.defaultSemesterMonths, defaultBreakMonths: parsed.data.defaultBreakMonths } } }),
  ]);
  revalidatePath("/", "layout"); revalidatePath("/settings");
  return { error: "", message: "Hostel settings saved successfully." };
}

const rateSchema = z.object({ id: z.string().min(1), monthlyRate: z.coerce.number().positive().max(1_000_000), semesterRate: z.coerce.number().positive().max(4_000_000), defaultCapacity: z.coerce.number().int().min(1).max(20) });
export async function updateAccommodationRatesAction(_state: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const session = await requireSettingsManager();
  if (!session) return { error: "Only the Owner or an Admin can change accommodation rates.", message: "" };
  const ids = formData.getAll("roomTypeId").map(String);
  const entries = ids.map((id) => rateSchema.safeParse({ id, monthlyRate: formData.get(`monthlyRate_${id}`), semesterRate: formData.get(`semesterRate_${id}`), defaultCapacity: formData.get(`defaultCapacity_${id}`) }));
  const invalid = entries.find((entry) => !entry.success);
  if (invalid && !invalid.success) return { error: invalid.error.issues[0]?.message ?? "Check the accommodation rates.", message: "" };
  const values = entries.flatMap((entry) => entry.success ? [entry.data] : []);
  if (!values.length) return { error: "No accommodation types were submitted.", message: "" };
  const types = await db.roomType.findMany({ where: { organizationId: session.organizationId, id: { in: ids } }, include: { rooms: { where: { capacityOverride: null }, include: { _count: { select: { occupancies: { where: { status: "ACTIVE" } } } } } } } });
  if (types.length !== values.length) return { error: "One or more accommodation types are unavailable.", message: "" };
  for (const value of values) {
    const conflict = types.find((item) => item.id === value.id)?.rooms.find((room) => room._count.occupancies > value.defaultCapacity);
    if (conflict) return { error: `Room ${conflict.number} has ${conflict._count.occupancies} occupants. Capacity cannot be reduced to ${value.defaultCapacity}.`, message: "" };
  }
  await db.$transaction([
    ...values.map((value) => db.roomType.update({ where: { id: value.id }, data: { monthlyRate: value.monthlyRate, semesterRate: value.semesterRate, defaultCapacity: value.defaultCapacity } })),
    db.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "ACCOMMODATION_RATES_UPDATED", entityType: "RoomType", metadata: { roomTypeIds: ids } } }),
  ]);
  revalidatePath("/settings"); revalidatePath("/rooms"); revalidatePath("/occupancy");
  return { error: "", message: "Accommodation rates and capacities saved successfully." };
}
