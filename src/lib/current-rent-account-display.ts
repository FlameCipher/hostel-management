/** The active account should show the room a resident occupies now.
 * The original charge description is immutable accounting history and is not
 * changed by this display-only helper. Prior receipts continue to show the
 * historic description unless explicitly labelled as a current account view.
 */
export type ActiveAccommodation = {
  status: string;
  room: {number: string; roomType: {id: string; name: string}};
};

export function currentRentAccountDisplay(input: {
  chargeType: string;
  description: string;
  semesterName?: string | null;
  chargeRoomTypeId?: string | null;
  occupancy?: ActiveAccommodation | null;
}) {
  const originalDescription = input.description;
  const occupancy = input.occupancy;
  if (input.chargeType !== "SEMESTER_RENT" ||
      occupancy?.status !== "ACTIVE" ||
      !occupancy.room.number.trim() ||
      !occupancy.room.roomType.name.trim()) {
    return {label: originalDescription, currentRoom: null, roomTypeMismatch: false, originalDescription};
  }
  const currentRoom = occupancy.room.number.trim();
  const accommodation = occupancy.room.roomType.name.trim();
  const semester = input.semesterName?.trim() || "Semester";
  return {
    label: `${semester} rent · Current Room ${currentRoom} (${accommodation})`,
    currentRoom,
    roomTypeMismatch: input.chargeRoomTypeId != null &&
      input.chargeRoomTypeId !== occupancy.room.roomType.id,
    originalDescription,
  };
}
