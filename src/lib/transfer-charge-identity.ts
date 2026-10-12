/** The original stay remains in OccupancyRoomStay and the audit log.
 * A student's active rent charge always identifies the current room and room type.
 */
export function transferRentChargeIdentity(input: {
  semesterName: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
}) {
  const {semesterName,roomNumber,roomTypeId,roomTypeName}=input;
  if(!semesterName.trim()||!roomNumber.trim()||!roomTypeId.trim()||!roomTypeName.trim()) {
    throw Error("INVALID_TRANSFER_CHARGE_IDENTITY");
  }
  return {
    roomTypeId,
    description: `${semesterName} rent · Room ${roomNumber} (${roomTypeName})`,
  };
}
