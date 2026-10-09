export const PHOTO_CATEGORIES = ["EXTERIOR", "COMPOUND", "ROOM"] as const;
export type PhotoCategory = typeof PHOTO_CATEGORIES[number];
export const PHOTO_GROUP_LIMIT = 4;
export const PHOTO_PROPERTY_LIMIT = 200;
export const photoCategoryLabels: Record<PhotoCategory, string> = {
  EXTERIOR: "Full building exterior", COMPOUND: "Hostel compound", ROOM: "Room interior",
};
export function photoClassification(category: unknown, roomTypeId: unknown, confirmed: unknown) {
  if (confirmed !== true || !PHOTO_CATEGORIES.includes(category as PhotoCategory)) throw Error("PHOTO_CLASSIFICATION_REQUIRED");
  const type = typeof roomTypeId === "string" ? roomTypeId.trim() : "";
  if (category === "ROOM" && (!type || type.length > 128)) throw Error("PHOTO_ROOM_TYPE_REQUIRED");
  if (category !== "ROOM" && type) throw Error("PHOTO_ROOM_TYPE_DENIED");
  return { category: category as PhotoCategory, roomTypeId: type || null };
}
