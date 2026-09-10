import type { RoomStatus } from "@/generated/prisma/enums";

export const roomStatusLabels: Record<RoomStatus, string> = {
  VACANT: "Vacant",
  PARTIALLY_OCCUPIED: "Part occupied",
  FULL: "Full",
  MAINTENANCE: "Maintenance",
  INACTIVE: "Inactive",
};

export const roomStatusTone: Record<RoomStatus, string> = {
  VACANT: "status-vacant-pill",
  PARTIALLY_OCCUPIED: "status-partial",
  FULL: "status-full",
  MAINTENANCE: "status-maintenance",
  INACTIVE: "status-inactive",
};

export function getEffectiveRoomStatus(
  storedStatus: RoomStatus,
  activeOccupants: number,
  capacity: number,
): RoomStatus {
  if (storedStatus === "MAINTENANCE" || storedStatus === "INACTIVE") return storedStatus;
  if (activeOccupants === 0) return "VACANT";
  if (activeOccupants >= capacity) return "FULL";
  return "PARTIALLY_OCCUPIED";
}
