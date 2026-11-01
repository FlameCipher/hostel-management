export function agreementActive(date: Date | null | undefined, now = new Date(), timeZone = "Africa/Nairobi") {
  if (!date || !Number.isFinite(date.getTime())) return false;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return date.toISOString().slice(0, 10) >= today;
}
export function parseAgreementDate(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00.000Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || !agreementActive(date, now) || date.getTime() > now.getTime() + 366 * 86400000) return null;
  return date;
}
