"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { RoomStatus } from "@/generated/prisma/enums";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { normalizeRoomIdentifier } from "@/lib/room-identifiers";
import { getEffectiveRoomStatus } from "@/lib/rooms";

export type RoomFormState = { error: string };
export type DeleteRoomState = { error: string };

const roomSchema = z.object({
  number: z.string().trim().min(1, "Enter a room number.").max(20, "Room number is too long."),
  roomTypeId: z.string().trim().min(1, "Select an accommodation type."),
  floor: z.string().trim().min(1, "Enter the floor.").max(40, "Floor name is too long."),
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
  const numberKey = normalizeRoomIdentifier(parsed.data.number);
  const floorKey = normalizeRoomIdentifier(parsed.data.floor);

  const [roomType, existingRoom] = await Promise.all([
    db.roomType.findFirst({ where: { id: parsed.data.roomTypeId, organizationId: session.organizationId, active: true } }),
    db.room.findUnique({
      where: {
        organizationId_floorKey_numberKey: {
          organizationId: session.organizationId,
          floorKey,
          numberKey,
        },
      },
    }),
  ]);
  if (!roomType) return { error: "The selected accommodation type is unavailable." };
  if (existingRoom) return { error: `Room ${parsed.data.number} already exists on ${parsed.data.floor}.` };

  const capacity = parsed.data.capacityOverride ?? roomType.defaultCapacity;
  const status: RoomStatus = parsed.data.status === "MAINTENANCE" || parsed.data.status === "INACTIVE"
    ? parsed.data.status
    : getEffectiveRoomStatus("VACANT", 0, capacity);

  try {
    await db.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          organizationId: session.organizationId,
          roomTypeId: roomType.id,
          number: parsed.data.number,
          numberKey,
          floor: parsed.data.floor,
          floorKey,
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
          metadata: { number: room.number, floor: room.floor, roomTypeId: room.roomTypeId },
        },
      });
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return { error: `Room ${parsed.data.number} already exists on ${parsed.data.floor}.` };
    }
    throw error;
  }

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
  const numberKey = normalizeRoomIdentifier(parsed.data.number);
  const floorKey = normalizeRoomIdentifier(parsed.data.floor);

  const [room, roomType, duplicate] = await Promise.all([
    db.room.findFirst({
      where: { id: roomId, organizationId: session.organizationId },
      include: {
        occupancies: { where: { status: "ACTIVE" }, select: { studentId: true } },
        breakReservations: { where: { status: { in: ["RESERVED_FREE", "CHARGED"] }, intent: "RETURNING", clearedAt: null }, select: { studentId: true } },
      },
    }),
    db.roomType.findFirst({ where: { id: parsed.data.roomTypeId, organizationId: session.organizationId, active: true } }),
    db.room.findFirst({
      where: {
        organizationId: session.organizationId,
        floorKey,
        numberKey,
        NOT: { id: roomId },
      },
    }),
  ]);
  if (!room) return { error: "This room could not be found." };
  if (!roomType) return { error: "The selected accommodation type is unavailable." };
  if (duplicate) return { error: `Room ${parsed.data.number} already exists on ${parsed.data.floor}.` };

  const activeOccupants = new Set([
    ...room.occupancies.map((item) => item.studentId),
    ...room.breakReservations.map((item) => item.studentId),
  ]).size;
  const capacity = parsed.data.capacityOverride ?? roomType.defaultCapacity;
  if (capacity < activeOccupants) return { error: `Capacity cannot be lower than the ${activeOccupants} current occupant(s).` };
  if (activeOccupants > 0 && (parsed.data.status === "MAINTENANCE" || parsed.data.status === "INACTIVE")) {
    return { error: "Check out or move current occupants before closing this room." };
  }

  const status = getEffectiveRoomStatus(parsed.data.status, activeOccupants, capacity);
  try {
    await db.$transaction([
      db.room.update({
        where: { id: room.id },
        data: {
          roomTypeId: roomType.id,
          number: parsed.data.number,
          numberKey,
          floor: parsed.data.floor,
          floorKey,
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
          metadata: { number: parsed.data.number, floor: parsed.data.floor, roomTypeId: roomType.id, status },
        },
      }),
    ]);
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return { error: `Room ${parsed.data.number} already exists on ${parsed.data.floor}.` };
    }
    throw error;
  }

  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  redirect("/rooms");
}

function isPrismaError(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export async function deleteRoomAction(
  roomId: string,
  _previousState: DeleteRoomState,
  _formData: FormData,
): Promise<DeleteRoomState> {
  void _previousState;
  void _formData;
  const session = await requireRoomManager();
  const room = await db.room.findFirst({
    where: { id: roomId, organizationId: session.organizationId },
    include: {
      _count: {
        select: {
          occupancies: true,
          breakReservations: true,
        },
      },
    },
  });

  if (!room) return { error: "This room could not be found." };
  if (room._count.occupancies > 0 || room._count.breakReservations > 0) {
    return {
      error: "This room has allocation or reservation history and cannot be deleted. Mark it Inactive instead.",
    };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.room.delete({ where: { id: room.id } });
      await tx.auditLog.create({
        data: {
          organizationId: session.organizationId,
          actorUserId: session.userId,
          action: "ROOM_DELETED",
          entityType: "Room",
          entityId: room.id,
          metadata: { number: room.number, floor: room.floor, roomTypeId: room.roomTypeId },
        },
      });
    });
  } catch (error) {
    if (isPrismaError(error, "P2003")) {
      return { error: "This room is now referenced by another record and cannot be deleted." };
    }
    throw error;
  }

  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  redirect("/rooms");
}
