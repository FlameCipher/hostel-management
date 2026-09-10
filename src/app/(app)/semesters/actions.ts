"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export type SemesterFormState = { error: string };

async function requireManager() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/semesters");
  return session;
}

const schema = z.object({ name: z.string().trim().min(3).max(100), startDate: z.string().date(), endDate: z.string().date(), months: z.coerce.number().int().min(1).max(12) });

export async function createSemesterAction(_state: SemesterFormState, formData: FormData): Promise<SemesterFormState> {
  const session = await requireManager();
  const parsed = schema.safeParse({ name: formData.get("name"), startDate: formData.get("startDate"), endDate: formData.get("endDate"), months: formData.get("months") });
  if (!parsed.success) return { error: "Enter a valid semester name, dates and payable months." };
  const startDate = new Date(`${parsed.data.startDate}T12:00:00.000Z`);
  const endDate = new Date(`${parsed.data.endDate}T12:00:00.000Z`);
  if (endDate <= startDate) return { error: "Semester end date must be after its start date." };
  const duplicate = await db.semester.findFirst({ where: { organizationId: session.organizationId, name: parsed.data.name } });
  if (duplicate) return { error: "A semester with this name already exists." };
  await db.semester.create({ data: { organizationId: session.organizationId, name: parsed.data.name, startDate, endDate, months: parsed.data.months, status: "UPCOMING" } });
  revalidatePath("/semesters"); redirect("/semesters");
}

export async function activateSemesterAction(formData: FormData) {
  const session = await requireManager();
  const id = String(formData.get("semesterId") ?? "");
  const semester = await db.semester.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!semester) return;
  await db.$transaction([
    db.semester.updateMany({ where: { organizationId: session.organizationId, status: "ACTIVE", NOT: { id } }, data: { status: "CLOSED" } }),
    db.semester.update({ where: { id }, data: { status: "ACTIVE" } }),
    db.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "SEMESTER_ACTIVATED", entityType: "Semester", entityId: id, metadata: { name: semester.name } } }),
  ]);
  revalidatePath("/semesters"); revalidatePath("/occupancy"); revalidatePath("/dashboard");
}

export async function closeSemesterAction(formData: FormData) {
  const session = await requireManager();
  const id = String(formData.get("semesterId") ?? "");
  await db.semester.updateMany({ where: { id, organizationId: session.organizationId, status: "ACTIVE" }, data: { status: "CLOSED" } });
  revalidatePath("/semesters"); revalidatePath("/occupancy");
}
