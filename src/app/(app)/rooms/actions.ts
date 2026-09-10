"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { RoomStatus } from "@/generated/prisma/enums";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getEffectiveRoomStatus } from "@/lib/rooms";

export type RoomFormState = { error: string };

const roomSchema = z.object({
  number: z.string().trim().min(1, "Enter a room number.").max(20, "Room number is too long."),
  roomTypeId: z.string().trim().min(1, "Select an accommodation type."),
  floor: z.string().trim().max(40, "Floor name is too long.").optional(),
  capacityOverride: z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().int().min(1).max(20).optional(),
  ),
  status: z.enum(["VACANT", "PARTIALLY_OCCUPIED", "FULL", "MAINTENANCE", "INACTIVE"]),
  notes: z.string().trim().max(500, "Notes must be 500 characters or fewer.").optional(),
});

async function requireRoomManager() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/rooms");
  return session;
}

function parseRoom(formData: FormData) {
  return roomSchema.safeParse({
    number: formData.get("number"),
    roomTypeId: formData.get("roomTypeId"),
    floor: formData.get("floor"),
    capacityOverride: formData.get("capacityOverride"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });
}

export async function createRoomAction(
  _previousState: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  const session = await requireRoomManager();
  const parsed = parseRoom(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the room details." };

  const [roomType, existingRoom] = await Promise.all([
    db.roomType.findFirst({ where: { id: parsed.data.roomTypeId, organizationId: session.organizationId, active: true } }),
    db.room.findFirst({ where: { organizationId: session.organizationId, number: parsed.data.number } }),
  ]);
  if (!roomType) return { error: "The selected accommodation type is unavailable." };
  if (existingRoom) return { error: `Room ${parsed.data.number} already exists.` };

  const capacity = parsed.data.capacityOverride ?? roomType.defaultCapacity;
  const status: RoomStatus = parsed.data.status === "MAINTENANCE" || parsed.data.status === "INACTIVE"
    ? parsed.data.status
    : getEffectiveRoomStatus("VACANT", 0, capacity);

  await db.$transaction(async (tx) => {
    const room = await tx.room.create({
      data: {
        organizationId: session.organizationId,
        roomTypeId: roomType.id,
        number: parsed.data.number,
        floor: parsed.data.floor || null,
        capacityOverride: parsed.data.capacityOverride,
        status,
        notes: parsed.data.notes || null,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "ROOM_CREATED",
        entityType: "Room",
        entityId: room.id,
        metadata: { number: room.number, roomTypeId: room.roomTypeId },
      },
    });
  });

  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  redirect("/rooms");
}

export async function updateRoomAction(
  roomId: string,
  _previousState: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  const session = await requireRoomManager();
  const parsed = parseRoom(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the room details." };

  const [room, roomType, duplicate] = await Promise.all([
    db.room.findFirst({
      where: { id: roomId, organizationId: session.organizationId },
      include: { _count: { select: { occupancies: { where: { status: "ACTIVE" } } } } },
    }),
    db.roomType.findFirst({ where: { id: parsed.data.roomTypeId, organizationId: session.organizationId, active: true } }),
    db.room.findFirst({ where: { organizationId: session.organizationId, number: parsed.data.number, NOT: { id: roomId } } }),
  ]);
  if (!room) return { error: "This room could not be found." };
  if (!roomType) return { error: "The selected accommodation type is unavailable." };
  if (duplicate) return { error: `Room ${parsed.data.number} already exists.` };

  const activeOccupants = room._count.occupancies;
  const capacity = parsed.data.capacityOverride ?? roomType.defaultCapacity;
  if (capacity < activeOccupants) return { error: `Capacity cannot be lower than the ${activeOccupants} current occupant(s).` };
  if (activeOccupants > 0 && (parsed.data.status === "MAINTENANCE" || parsed.data.status === "INACTIVE")) {
    return { error: "Check out or move current occupants before closing this room." };
  }

  const status = getEffectiveRoomStatus(parsed.data.status, activeOccupants, capacity);
  await db.$transaction([
    db.room.update({
      where: { id: room.id },
      data: {
        roomTypeId: roomType.id,
        number: parsed.data.number,
        floor: parsed.data.floor || null,
        capacityOverride: parsed.data.capacityOverride,
        status,
        notes: parsed.data.notes || null,
      },
    }),
    db.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "ROOM_UPDATED",
        entityType: "Room",
        entityId: room.id,
        metadata: { number: parsed.data.number, roomTypeId: roomType.id, status },
      },
    }),
  ]);

  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  redirect("/rooms");
}
