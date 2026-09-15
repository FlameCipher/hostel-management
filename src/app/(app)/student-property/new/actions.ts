"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { PropertyCategory } from "@/generated/prisma/enums";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export type BatchPropertyState = { error: string };

const commonItems: Record<string, { name: string; category: PropertyCategory }> = {
  phone: { name: "Mobile phone", category: "ELECTRONICS" },
  laptop: { name: "Laptop", category: "LAPTOP" },
  tablet: { name: "Tablet", category: "ELECTRONICS" },
  television: { name: "Television", category: "ELECTRONICS" },
  speaker: { name: "Speaker", category: "ELECTRONICS" },
  iron: { name: "Electric iron", category: "ELECTRONICS" },
  cooker: { name: "Electric cooker", category: "ELECTRONICS" },
  suitcase: { name: "Suitcase", category: "SUITCASE" },
  mattress: { name: "Mattress", category: "MATTRESS" },
  bicycle: { name: "Bicycle", category: "BICYCLE" },
};

const schema = z.object({
  occupancyId: z.string().min(1),
  condition: z.enum(["NEW", "GOOD", "FAIR", "DAMAGED", "MISSING", "NOT_APPLICABLE"]),
  notes: z.string().trim().max(500).optional(),
});

function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function createBatchPropertyAction(
  _state: BatchPropertyState,
  formData: FormData,
): Promise<BatchPropertyState> {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/student-property");

  const parsed = schema.safeParse({
    occupancyId: formData.get("occupancyId"),
    condition: formData.get("condition"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: "Select a student and the condition of the items." };

  const occupancy = await db.occupancy.findFirst({
    where: { id: parsed.data.occupancyId, organizationId: session.organizationId, status: "ACTIVE" },
  });
  if (!occupancy) return { error: "Select an active student occupancy." };

  const selected = formData.getAll("commonItems").flatMap((value) => {
    const item = commonItems[String(value)];
    return item ? [item] : [];
  });
  const otherItems = String(formData.get("otherItems") ?? "")
    .split(/[\n,]/)
    .map(normalizedName)
    .filter(Boolean)
    .map((name) => ({ name, category: "OTHER" as const }));

  const unique = new Map<string, { name: string; category: PropertyCategory }>();
  for (const item of [...selected, ...otherItems]) unique.set(item.name.toLocaleLowerCase(), item);
  const items = [...unique.values()];
  if (!items.length) return { error: "Select at least one common item or enter another item." };
  if (items.length > 30) return { error: "Add no more than 30 items at once." };

  const existing = await db.studentPropertyItem.findMany({
    where: { occupancyId: occupancy.id },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((item) => normalizedName(item.name).toLocaleLowerCase()));
  const newItems = items.filter((item) => !existingNames.has(item.name.toLocaleLowerCase()));
  if (!newItems.length) return { error: "All selected items are already recorded for this student." };

  await db.$transaction(async (tx) => {
    await tx.studentPropertyItem.createMany({
      data: newItems.map((item) => ({
        occupancyId: occupancy.id,
        name: item.name,
        category: item.category,
        checkInCondition: parsed.data.condition,
        notes: parsed.data.notes || null,
      })),
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "STUDENT_PROPERTY_BATCH_ADDED",
        entityType: "Occupancy",
        entityId: occupancy.id,
        metadata: { count: newItems.length, items: newItems.map((item) => item.name) },
      },
    });
  });

  revalidatePath("/student-property");
  revalidatePath(`/occupancy/${occupancy.id}`);
  redirect("/student-property");
}
