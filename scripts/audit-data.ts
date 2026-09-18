import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getEffectiveRoomStatus } from "../src/lib/rooms";
import { normalizeStudentDocument, normalizeStudentPhone } from "../src/lib/student-identifiers";

const connectionString = process.env.PRODUCTION_DATABASE_URL ?? process.env.DB_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set PRODUCTION_DATABASE_URL, DB_DATABASE_URL or DATABASE_URL.");
if (process.env.DATA_AUDIT_CONFIRM !== "READ_ONLY") throw new Error('Set DATA_AUDIT_CONFIRM="READ_ONLY" to run this non-mutating audit.');

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const findings: string[] = [];

function findDuplicates(values: Array<string | null | undefined>, normalize: (value: string) => string | null) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    const key = normalize(value);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

async function main() {
  const organizations = await db.organization.findMany({ select: { id: true, name: true } });
  console.log(`Auditing ${organizations.length} organization(s). No data will be changed.`);

  for (const organization of organizations) {
    const [students, occupancies, rooms, charges, payments, breakReservations, activeSemesters] = await Promise.all([
      db.student.findMany({ where: { organizationId: organization.id }, select: { phone: true, admissionNumber: true, nationalId: true } }),
      db.occupancy.findMany({ where: { organizationId: organization.id, status: "ACTIVE" }, select: { studentId: true, roomId: true, student: { select: { status: true } }, roomStays: { where: { endDate: null }, select: { roomId: true } } } }),
      db.room.findMany({ where: { organizationId: organization.id }, include: { roomType: { select: { defaultCapacity: true } }, occupancies: { where: { status: "ACTIVE" }, select: { studentId: true } }, breakReservations: { where: { status: { in: ["RESERVED_FREE", "CHARGED"] }, intent: "RETURNING", clearedAt: null }, select: { studentId: true } } } }),
      db.charge.findMany({ where: { organizationId: organization.id, status: { not: "WAIVED" } }, include: { payments: { where: { reversedAt: null }, select: { amount: true } }, adjustments: { select: { adjustmentAmount: true } } } }),
      db.payment.findMany({ where: { organizationId: organization.id }, select: { studentId: true, charge: { select: { studentId: true } } } }),
      db.breakReservation.findMany({ where: { organizationId: organization.id }, select: { status: true, belongingsStored: true, charge: { select: { id: true } } } }),
      db.semester.count({ where: { organizationId: organization.id, status: "ACTIVE" } }),
    ]);
    const prefix = organization.name;
    const duplicatePhones = findDuplicates(students.map((item) => item.phone), (value) => normalizeStudentPhone(value));
    const duplicateAdmissions = findDuplicates(students.map((item) => item.admissionNumber), normalizeStudentDocument);
    const duplicateIds = findDuplicates(students.map((item) => item.nationalId), normalizeStudentDocument);
    if (duplicatePhones) findings.push(`${prefix}: ${duplicatePhones} duplicated normalized phone value(s)`);
    if (duplicateAdmissions) findings.push(`${prefix}: ${duplicateAdmissions} duplicated normalized admission value(s)`);
    if (duplicateIds) findings.push(`${prefix}: ${duplicateIds} duplicated normalized national ID value(s)`);
    if (activeSemesters > 1) findings.push(`${prefix}: ${activeSemesters} semesters are active`);

    const occupancyCounts = new Map<string, number>();
    for (const occupancy of occupancies) {
      occupancyCounts.set(occupancy.studentId, (occupancyCounts.get(occupancy.studentId) ?? 0) + 1);
      if (occupancy.student.status !== "ACTIVE") findings.push(`${prefix}: an active occupancy belongs to a non-active student`);
      if (occupancy.roomStays.length !== 1) findings.push(`${prefix}: an active occupancy does not have exactly one open room-stay segment`);
      else if (occupancy.roomStays[0].roomId !== occupancy.roomId) findings.push(`${prefix}: an active occupancy room differs from its open room-stay segment`);
    }
    const multipleActive = [...occupancyCounts.values()].filter((count) => count > 1).length;
    if (multipleActive) findings.push(`${prefix}: ${multipleActive} student(s) have multiple active occupancies`);

    for (const room of rooms) {
      const held = new Set([...room.occupancies.map((item) => item.studentId), ...room.breakReservations.map((item) => item.studentId)]).size;
      const capacity = room.capacityOverride ?? room.roomType.defaultCapacity;
      if (held > capacity) findings.push(`${prefix}: a room exceeds capacity (${held}/${capacity})`);
      const expected = getEffectiveRoomStatus(room.status, held, capacity);
      if (expected !== room.status) findings.push(`${prefix}: a room has stale status ${room.status}; expected ${expected}`);
    }
    for (const charge of charges) {
      const paid = charge.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const hasCreditAdjustment = charge.adjustments.some((adjustment) => Number(adjustment.adjustmentAmount) < 0);
      if (paid > Number(charge.amount) + 0.001 && !hasCreditAdjustment) findings.push(`${prefix}: a charge is overpaid without an approved credit adjustment`);
    }
    const mismatchedPayments = payments.filter((payment) => payment.studentId !== payment.charge.studentId).length;
    if (mismatchedPayments) findings.push(`${prefix}: ${mismatchedPayments} payment(s) belong to a different student than their charge`);
    const invalidFreeHolds = breakReservations.filter((item) => item.status === "RESERVED_FREE" && item.belongingsStored).length;
    const chargedWithoutCharge = breakReservations.filter((item) => item.status === "CHARGED" && !item.charge).length;
    if (invalidFreeHolds) findings.push(`${prefix}: ${invalidFreeHolds} free break hold(s) still have belongings recorded`);
    if (chargedWithoutCharge) findings.push(`${prefix}: ${chargedWithoutCharge} charged break reservation(s) have no charge record`);
  }

  if (findings.length) {
    console.error(`Audit found ${findings.length} issue(s):`);
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
  } else {
    console.log("Audit passed: no consistency issues were found.");
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
