import { validTimeZone } from "./property-location";
export function hostelTimeZone(zone?: string | null, country?: string | null) {
  return zone && validTimeZone(zone) ? zone : country === "KE" ? "Africa/Nairobi" : "UTC";
}
function partsAt(date: Date, zone: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const v = (type: string) => p.find(x => x.type === type)!.value;
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
}
// Reject missing/ambiguous daylight-saving times instead of guessing a visit time.
export function visitLocalTime(value: string, zone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validTimeZone(zone)) return null;
  const base = Date.parse(value + ":00Z");
  if (!Number.isFinite(base) || new Date(base).toISOString().slice(0, 16) !== value) return null;
  const matches = new Set<number>();
  for (const hours of [-36, 0, 36]) {
    const sample = base + hours * 3600000;
    const offset = Date.parse(partsAt(new Date(sample), zone) + ":00Z") - sample;
    const candidate = base - offset;
    if (partsAt(new Date(candidate), zone) === value) matches.add(candidate);
  }
  return matches.size === 1 ? new Date([...matches][0]) : null;
}
export function visitorOverdue(visit: { status: string; expectedDeparture: Date }, now = new Date()) {
  return visit.status === "CHECKED_IN" && visit.expectedDeparture < now;
}
export const visitorLabels: Record<string, string> = { REQUESTED: "Awaiting verification", APPROVED: "Approved — not yet arrived", CHECKED_IN: "Checked in", CHECKED_OUT: "Checked out", DENIED: "Declined", CANCELLED: "Cancelled" };
export function visitTransition(status: string, action: string) {
  const allowed: Record<string, string[]> = { APPROVE: ["REQUESTED"], DENY: ["REQUESTED", "APPROVED"], CHECK_IN: ["REQUESTED", "APPROVED"], CHECK_OUT: ["CHECKED_IN"], CANCEL: ["REQUESTED", "APPROVED"] };
  return allowed[action]?.includes(status) ?? false;
}
export const normalizedResidentName = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase();
