/** A phone is a login identifier, never proof of phone ownership or OTP delivery. */
export function normalizeStaffPhone(value: string, country?: string | null): string | null {
  if (!/^[+0-9 ()-]+$/.test(value)) return null;
  let compact = value.replace(/[ ()-]/g, "");
  if (compact.startsWith("00")) compact = "+" + compact.slice(2);
  if (country === "KE" && /^0[17]\d{8}$/.test(compact)) compact = "+254" + compact.slice(1);
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

export function validDutyTimeZone(value: string): boolean {
  if (!value || value.length > 80) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; }
  catch { return false; }
}

export function staffDutyLabel(user: { dutyStart?: string | null; dutyEnd?: string | null; dutyTimeZone?: string | null }): string {
  if (!user.dutyStart || !user.dutyEnd || !user.dutyTimeZone) return "Not recorded";
  const format = (v: string) => { const [h, m] = v.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`; };
  return `${format(user.dutyStart)}–${format(user.dutyEnd)} · ${user.dutyTimeZone}${user.dutyEnd < user.dutyStart ? " (overnight)" : ""}`;
}
