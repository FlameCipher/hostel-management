import { createHash } from "node:crypto";
import { formatMoney, minorUnits, currencyDigits } from "@/lib/currency";

export type ArrearsCharge = {
  id: string; organizationId: string; studentId: string; currency: string; amount: { toString(): string }; dueDate: Date; status: string;
  payments: { amount: { toString(): string }; organizationId: string; studentId: string; currency: string; reversedAt: Date | null }[];
};
export function arrearsPosition(charges: ArrearsCharge[], organizationId: string, studentId: string, currency: string, now: Date, timeZone: string) {
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  let balanceMinor = 0, oldest: Date | null = null;
  for (const charge of charges) {
    if (charge.status === "WAIVED") continue;
    const payments = charge.payments.filter(p => !p.reversedAt);
    if (charge.organizationId !== organizationId || charge.studentId !== studentId || charge.currency !== currency || payments.some(p => p.organizationId !== organizationId || p.studentId !== studentId || p.currency !== currency)) return { error: "Account entries need review." };
    let amount: number, paid: number;
    try { amount = minorUnits(Number(charge.amount), currency); paid = payments.reduce((sum, p) => sum + minorUnits(Number(p.amount), currency), 0); }
    catch { return { error: "Account entries need review." }; }
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(paid) || amount < 0 || paid < 0 || paid > amount) return { error: "Account entries need review." };
    if (day(charge.dueDate) >= day(now) || amount <= paid) continue;
    balanceMinor += amount - paid;
    if (!oldest || charge.dueDate < oldest) oldest = charge.dueDate;
  }
  if (!Number.isSafeInteger(balanceMinor)) return { error: "Account entries need review." };
  return { balance: balanceMinor / 10 ** currencyDigits(currency), oldest };
}
export function arrearsFingerprint(input: { studentId: string; amount: number; currency: string; due: string; phone: string; email: string; name: string; room: string }) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
export function arrearsMessage(input: { hostel: string; name: string; amount: number; currency: string; due: string; login: string }) {
  return `${input.hostel}\n\nHello ${input.name}, your overdue accommodation balance is ${formatMoney(input.amount, input.currency)}. The earliest unpaid due date is ${input.due}.\n\nPlease clear the overdue amount as soon as possible. If you have already paid, send your payment reference to management so we can update your account. Contact management if you need to discuss payment.\n\nView your statement and contact management: ${input.login}`;
}
export const ARREARS_INTERVAL_DAYS = 7;
export function arrearsCooldown(last: Date | null, now: Date, days = ARREARS_INTERVAL_DAYS) {
  return !!last && last.getTime() > now.getTime() - days * 86400000;
}
