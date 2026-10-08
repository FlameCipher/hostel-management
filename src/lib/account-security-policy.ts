export function localSessionCurrent(version: unknown, current: number) {
  const issued = version === undefined ? 0 : version;
  return typeof issued === "number" && Number.isSafeInteger(issued) && issued >= 0 && issued === current;
}
