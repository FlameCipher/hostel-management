const roomNumberCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function roomNumberGroup(value: string) {
  const normalized = value.trim();
  if (/^[A-Za-z]+$/.test(normalized)) return 0;
  if (/^\d+$/.test(normalized)) return 1;
  return 2;
}

/** Alphabetic room names first, numeric rooms second, then mixed identifiers. */
export function compareRoomNumbers(left: string, right: string) {
  const groupDifference = roomNumberGroup(left) - roomNumberGroup(right);
  if (groupDifference !== 0) return groupDifference;
  return roomNumberCollator.compare(left.trim(), right.trim());
}

export function compareRooms<T extends { number: string; floor?: string | null }>(left: T, right: T) {
  return compareRoomNumbers(left.number, right.number)
    || roomNumberCollator.compare(left.floor?.trim() ?? "", right.floor?.trim() ?? "");
}
