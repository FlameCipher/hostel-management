import type { Prisma } from "@/generated/prisma/client";
import { refreshChargeStatus } from "@/lib/payment-balance";

const DAY_MS = 86_400_000;

export type RentMethod = "KEEP_FULL" | "STANDARD_RATE" | "ACTUAL_DAYS" | "CUSTOM";

export type RentSegment = {
  roomId: string;
  roomTypeId: string;
  startDate: Date;
  endDate: Date;
  semesterRate: number;
};

function utcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function addUtcDays(value: Date, days: number) {
  return new Date(utcDay(value) + days * DAY_MS);
}

export function daysBetween(start: Date, endExclusive: Date) {
  return Math.max(0, Math.round((utcDay(endExclusive) - utcDay(start)) / DAY_MS));
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateActualDaysRent(input: {
  semesterStart: Date;
  semesterEnd: Date;
  segments: RentSegment[];
}) {
  const semesterEndExclusive = addUtcDays(input.semesterEnd, 1);
  const totalDays = Math.max(1, daysBetween(input.semesterStart, semesterEndExclusive));
  const lines = input.segments.map((segment) => {
    const start = segment.startDate < input.semesterStart ? input.semesterStart : segment.startDate;
    const end = segment.endDate > semesterEndExclusive ? semesterEndExclusive : segment.endDate;
    const days = daysBetween(start, end);
    const amount = roundMoney(segment.semesterRate * days / totalDays);
    return { ...segment, startDate: start, endDate: end, days, amount };
  }).filter((line) => line.days > 0);
  return {
    totalDays,
    amount: roundMoney(lines.reduce((sum, line) => sum + line.amount, 0)),
    lines,
  };
}

export function calculateBreakStorageCharge(input: {
  mode: "MONTHLY_RATE_MONTHS" | "FLAT_AMOUNT" | "PERCENTAGE_MONTHLY_RATE";
  value: number | null;
  months: number;
  monthlyRate: number;
}) {
  if (input.mode === "FLAT_AMOUNT") return roundMoney(input.value ?? 0);
  if (input.mode === "PERCENTAGE_MONTHLY_RATE") {
    return roundMoney(input.monthlyRate * input.months * (input.value ?? 100) / 100);
  }
  return roundMoney(input.monthlyRate * input.months);
}

type AdjustmentInput = {
  organizationId: string;
  chargeId: string;
  createdById: string;
  reason: "ROOM_TRANSFER" | "EARLY_CHECKOUT" | "RATE_CORRECTION" | "DISCOUNT" | "BREAK_STORAGE" | "MANUAL";
  calculationMethod: RentMethod;
  newAmount: number;
  effectiveDate: Date;
  explanation: string;
  calculationData?: Prisma.InputJsonValue;
};

export async function applyChargeAmount(tx: Prisma.TransactionClient, input: AdjustmentInput) {
  const charge = await tx.charge.findFirst({
    where: { id: input.chargeId, organizationId: input.organizationId },
    include: { payments: { where: { reversedAt: null }, select: { amount: true } } },
  });
  if (!charge) throw new Error("RENT_CHARGE_NOT_FOUND");
  const previousAmount = Number(charge.amount);
  const newAmount = roundMoney(input.newAmount);
  if (newAmount < 0) throw new Error("INVALID_RENT_AMOUNT");
  if (Math.abs(previousAmount - newAmount) < 0.005) {
    const paid = charge.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    return { changed: false, previousAmount, newAmount, paid, balance: Math.max(0, newAmount - paid), credit: Math.max(0, paid - newAmount) };
  }
  await tx.charge.update({
    where: { id: charge.id },
    data: { amount: newAmount, baseAmount: charge.baseAmount ?? charge.amount },
  });
  await tx.chargeAdjustment.create({
    data: {
      organizationId: input.organizationId,
      chargeId: charge.id,
      createdById: input.createdById,
      reason: input.reason,
      calculationMethod: input.calculationMethod,
      previousAmount,
      newAmount,
      adjustmentAmount: roundMoney(newAmount - previousAmount),
      effectiveDate: input.effectiveDate,
      explanation: input.explanation,
      calculationData: input.calculationData,
    },
  });
  await refreshChargeStatus(tx, charge.id);
  const paid = charge.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  return { changed: true, previousAmount, newAmount, paid, balance: Math.max(0, newAmount - paid), credit: Math.max(0, paid - newAmount) };
}
