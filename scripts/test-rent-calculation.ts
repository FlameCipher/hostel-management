import assert from "node:assert/strict";
import { addUtcDays, calculateActualDaysRent, calculateBreakStorageCharge } from "../src/lib/rent-calculation";

const date = (value: string) => new Date(`${value}T12:00:00.000Z`);

const transfer = calculateActualDaysRent({
  semesterStart: date("2026-09-01"),
  semesterEnd: date("2026-12-31"),
  segments: [
    { roomId: "shared", roomTypeId: "shared-type", startDate: date("2026-09-01"), endDate: date("2026-11-01"), semesterRate: 24_000 },
    { roomId: "private", roomTypeId: "private-type", startDate: date("2026-11-01"), endDate: addUtcDays(date("2026-12-31"), 1), semesterRate: 36_000 },
  ],
});
assert.equal(transfer.totalDays, 122);
assert.equal(transfer.amount, 30_000);

const earlyCheckout = calculateActualDaysRent({
  semesterStart: date("2026-09-01"),
  semesterEnd: date("2026-12-31"),
  segments: [{ roomId: "private", roomTypeId: "private-type", startDate: date("2026-09-01"), endDate: date("2026-10-01"), semesterRate: 36_000 }],
});
assert.equal(earlyCheckout.amount, 8_852.46);

const lateCheckIn = calculateActualDaysRent({
  semesterStart: date("2026-09-01"),
  semesterEnd: date("2026-12-31"),
  segments: [{ roomId: "private", roomTypeId: "private-type", startDate: date("2026-11-01"), endDate: addUtcDays(date("2026-12-31"), 1), semesterRate: 36_000 }],
});
assert.equal(lateCheckIn.amount, 18_000);

assert.equal(calculateBreakStorageCharge({ mode: "MONTHLY_RATE_MONTHS", value: null, months: 3, monthlyRate: 9_000 }), 27_000);
assert.equal(calculateBreakStorageCharge({ mode: "FLAT_AMOUNT", value: 5_000, months: 3, monthlyRate: 9_000 }), 5_000);
assert.equal(calculateBreakStorageCharge({ mode: "PERCENTAGE_MONTHLY_RATE", value: 50, months: 3, monthlyRate: 9_000 }), 13_500);

console.log("Rent calculation tests passed.");
