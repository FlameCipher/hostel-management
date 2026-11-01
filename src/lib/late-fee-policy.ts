import { currencyDigits, minorUnits } from "./currency";

export const LATE_FEE_VERSION = "2026-11-01-v3";
export const LATE_FEE_ORGANIZATION = "mama-mbugua-hostel";
export const LATE_FEE_RATE = 10;
export const hostelDay = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

// The first future monthly clearance date is fixed in the student's accepted copy.
// Accepting on the 10th starts the new rule with the following month's 10th.
export function firstLateFeeDeadline(acceptedAt: Date) {
  const [year, month, day] = hostelDay(acceptedAt).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + (day >= 10 ? 1 : 0), 10)).toISOString().slice(0, 10);
}
export function lateFeeDeadline(dueDate: Date, notBeforeDate: string, agreedDate?: Date | null) {
  return [hostelDay(dueDate), notBeforeDate, agreedDate?.toISOString().slice(0, 10) ?? ""].sort().at(-1)!;
}
export function lateFeeAmount(unpaid: number, currency: string) {
  const minor = minorUnits(unpaid, currency);
  if (minor < 0) throw Error("INVALID_LATE_FEE_BASIS");
  // Integer minor units, rounded half up; never compound an existing fee.
  return Number((BigInt(minor) + BigInt(5)) / BigInt(10)) / 10 ** currencyDigits(currency);
}
export function displayHostelDate(day: string) {
  return new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", year: "numeric" });
}
