export function normalizeRoomIdentifier(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}
