"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export type BatchPropertyState = {
  error: string;
};

const propertyItemSchema = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.enum([
    "LAPTOP",
    "SUITCASE",
    "MATTRESS",
    "ELECTRONICS",
    "BICYCLE",
    "OTHER",
  ]),
  checkInCondition: z.enum([
    "NEW",
    "GOOD",
    "FAIR",
    "DAMAGED",
    "MISSING",
    "NOT_APPLICABLE",
  ]),
  description: z.string().trim().max(250).optional().default(""),
});

const propertyBatchSchema = z.object({
  occupancyId: z.string().min(1, "Select a student and room."),
  items: z
    .array(propertyItemSchema)
    .min(1, "Select or add at least one property item.")
    .max(50, "A maximum of 50 items can be recorded at once."),
});

function normalizedItemName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function createStudentPropertyBatchAction(
  _previousState: BatchPropertyState,
  formData: FormData,
): Promise<BatchPropertyState> {
  const session = await requireSession();

  const occupancyId = String(formData.get("occupancyId") ?? "");
  const itemsJson = String(formData.get("itemsJson") ?? "");

  let submittedItems: unknown;

  try {
    submittedItems = JSON.parse(itemsJson);
  } catch {
    return { error: "The submitted property list is invalid." };
  }

  const parsed = propertyBatchSchema.safeParse({
    occupancyId,
    items: submittedItems,
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Check the submitted property information.",
    };
  }

  const submittedNames = new Set<string>();

  for (const item of parsed.data.items) {
    const normalizedName = normalizedItemName(item.name);

    if (submittedNames.has(normalizedName)) {
      return {
        error: `${item.name} appears more than once in the property list.`,
      };
    }

    submittedNames.add(normalizedName);
  }

  const occupancy = await db.occupancy.findFirst({
    where: {
      id: parsed.data.occupancyId,
      organizationId: session.organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      studentId: true,
      student: {
        select: {
          fullName: true,
        },
      },
      room: {
        select: {
          number: true,
        },
      },
    },
  });

  if (!occupancy) {
    return {
      error: "The selected student does not have an active room allocation.",
    };
  }

  try {
    await db.$transaction(
      async (tx) => {
        const existingItems = await tx.studentPropertyItem.findMany({
        where: {
            occupancyId: occupancy.id,
        },
        select: {
            name: true,
        },
        });

        const existingNames = new Set(
          existingItems.map((item) => normalizedItemName(item.name)),
        );

        const duplicateItem = parsed.data.items.find((item) =>
          existingNames.has(normalizedItemName(item.name)),
        );

        if (duplicateItem) {
          throw new Error(`DUPLICATE_ITEM:${duplicateItem.name}`);
        }

        
        await tx.studentPropertyItem.createMany({
            data: parsed.data.items.map((item) => ({
                occupancyId: occupancy.id,
                name: item.name,
                category: item.category,
                checkInCondition: item.checkInCondition,
                description: item.description || null,
            })),
        });

        await tx.auditLog.create({
          data: {
            organizationId: session.organizationId,
            actorUserId: session.userId,
            action: "STUDENT_PROPERTY_BATCH_CREATED",
            entityType: "Occupancy",
            entityId: occupancy.id,
            metadata: {
              studentId: occupancy.studentId,
              studentName: occupancy.student.fullName,
              roomNumber: occupancy.room.number,
              itemCount: parsed.data.items.length,
              items: parsed.data.items.map((item) => item.name),
            },
          },
        });
      },
      {
        isolationLevel: "Serializable",
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.startsWith("DUPLICATE_ITEM:")) {
      const itemName = message.slice("DUPLICATE_ITEM:".length);

      return {
        error: `${itemName} is already registered for this student’s current occupancy.`,
      };
    }

    throw error;
  }

  revalidatePath("/student-property");
  revalidatePath(`/occupancy/${occupancy.id}`);

  redirect("/student-property");
}