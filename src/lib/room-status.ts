import type { Prisma } from "@/generated/prisma/client";
import { getEffectiveRoomStatus } from "@/lib/rooms";

export const activeBreakHoldWhere = {
  status: { in: ["RESERVED_FREE", "CHARGED"] },
  clearedAt: null,
  intent: "RETURNING",
} satisfies Prisma.BreakReservationWhereInput;

export async function refreshRoomStatus(tx: Prisma.TransactionClient, roomId: string) {
  const room = await tx.room.findUnique({
    where: { id: roomId },
    include: {
      roomType: { select: { defaultCapacity: true } },
      occupancies: { where: { status: "ACTIVE" }, select: { studentId: true } },
      breakReservations: { where: activeBreakHoldWhere, select: { studentId: true } },
    },
  });
  if (!room) return;
  const held = new Set([
    ...room.occupancies.map((item) => item.studentId),
    ...room.breakReservations.map((item) => item.studentId),
  ]).size;
  const capacity = room.capacityOverride ?? room.roomType.defaultCapacity;
  const status = getEffectiveRoomStatus(room.status, held, capacity);
  if (status !== room.status) await tx.room.update({ where: { id: room.id }, data: { status } });
}
