"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { refreshRoomStatus } from "@/lib/room-status";

export type BreakFormState = { error: string };

async function requireManager() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/occupancy");
  return session;
}

const periodSchema = z.object({
  name: z.string().trim().min(3).max(100),
  startDate: z.string().date(),
  endDate: z.string().date(),
  months: z.coerce.number().int().min(1).max(12),
});

export async function createBreakPeriodAction(_state: BreakFormState, formData: FormData): Promise<BreakFormState> {
  const session = await requireManager();
  const parsed = periodSchema.safeParse({ name: formData.get("name"), startDate: formData.get("startDate"), endDate: formData.get("endDate"), months: formData.get("months") });
  if (!parsed.success) return { error: "Enter a valid break name, dates and duration." };
  const startDate = new Date(`${parsed.data.startDate}T12:00:00.000Z`);
  const endDate = new Date(`${parsed.data.endDate}T12:00:00.000Z`);
  if (endDate <= startDate) return { error: "Break end date must be after its start date." };
  const duplicate = await db.breakPeriod.findFirst({ where: { organizationId: session.organizationId, name: parsed.data.name } });
  if (duplicate) return { error: "A break period with this name already exists." };
  await db.breakPeriod.create({ data: { organizationId: session.organizationId, name: parsed.data.name, startDate, endDate, months: parsed.data.months, status: "UPCOMING" } });
  revalidatePath("/occupancy");
  return { error: "" };
}

const decisionSchema = z.object({
  breakPeriodId: z.string().min(1),
  occupancyId: z.string().min(1),
  intent: z.enum(["RETURNING", "NOT_RETURNING"]),
  belongingsStored: z.boolean(),
  notes: z.string().trim().max(500).optional(),
});

export async function saveBreakDecisionAction(_state: BreakFormState, formData: FormData): Promise<BreakFormState> {
  const session = await requireManager();
  const parsed = decisionSchema.safeParse({
    breakPeriodId: formData.get("breakPeriodId"), occupancyId: formData.get("occupancyId"), intent: formData.get("intent"),
    belongingsStored: formData.get("belongingsStored") === "on", notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: "Select a break period, student and return intention." };
  if (parsed.data.intent === "NOT_RETURNING" && parsed.data.belongingsStored) return { error: "A student who is not returning must remove belongings and clear the room before the break." };

  const [period, occupancy] = await Promise.all([
    db.breakPeriod.findFirst({ where: { id: parsed.data.breakPeriodId, organizationId: session.organizationId } }),
    db.occupancy.findFirst({ where: { id: parsed.data.occupancyId, organizationId: session.organizationId, status: "ACTIVE" }, include: { room: { include: { roomType: true } } } }),
  ]);
  if (!period || !occupancy) return { error: "The selected break period or active student allocation is unavailable." };
  const previous = await db.breakReservation.findUnique({
    where: { breakPeriodId_studentId: { breakPeriodId: period.id, studentId: occupancy.studentId } },
    include: { charge: { include: { payments: true } } },
  });
  const potentialCharge = Number(occupancy.room.roomType.monthlyRate) * period.months;
  const shouldCharge = parsed.data.intent === "RETURNING" && parsed.data.belongingsStored;
  const status = parsed.data.intent === "NOT_RETURNING" ? "CLEARANCE_REQUIRED" : shouldCharge ? "CHARGED" : "RESERVED_FREE";
  if (!shouldCharge && previous?.charge?.payments.length) return { error: "This break charge already has payment history and cannot be removed. Keep the charged decision or reverse the payment first." };
  if (shouldCharge && previous?.charge?.payments.length && Number(previous.charge.amount) !== potentialCharge) return { error: "This break charge has payment history, so its amount cannot be changed." };
  await db.$transaction(async (tx) => {
    const reservation = await tx.breakReservation.upsert({
      where: { breakPeriodId_studentId: { breakPeriodId: period.id, studentId: occupancy.studentId } },
      create: { organizationId: session.organizationId, breakPeriodId: period.id, studentId: occupancy.studentId, roomId: occupancy.roomId, intent: parsed.data.intent, status, belongingsStored: parsed.data.belongingsStored, monthlyRateSnapshot: occupancy.room.roomType.monthlyRate, potentialCharge, declaredAt: new Date(), notes: parsed.data.notes || null },
      update: { roomId: occupancy.roomId, intent: parsed.data.intent, status, belongingsStored: parsed.data.belongingsStored, monthlyRateSnapshot: occupancy.room.roomType.monthlyRate, potentialCharge, declaredAt: new Date(), notes: parsed.data.notes || null, clearedAt: null, returnConfirmedAt: null },
    });
    if (shouldCharge) {
      await tx.charge.upsert({
        where: { breakReservationId: reservation.id },
        create: { organizationId: session.organizationId, studentId: occupancy.studentId, breakReservationId: reservation.id, type: "BREAK_ACCOMMODATION", description: `${period.name} belongings accommodation`, amount: potentialCharge, dueDate: period.startDate, status: "UNPAID" },
        update: { amount: potentialCharge, dueDate: period.startDate, description: `${period.name} belongings accommodation` },
      });
    } else if (previous?.charge) {
      await tx.charge.delete({ where: { id: previous.charge.id } });
    }
    await refreshRoomStatus(tx, occupancy.roomId);
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "BREAK_DECISION_SAVED", entityType: "BreakReservation", entityId: reservation.id, metadata: { intent: parsed.data.intent, belongingsStored: parsed.data.belongingsStored, charged: shouldCharge } } });
  });
  revalidatePath("/occupancy"); revalidatePath("/rooms");
  return { error: "" };
}

async function getReservation(id: string, organizationId: string) {
  return db.breakReservation.findFirst({ where: { id, organizationId }, include: { breakPeriod: true, room: { include: { roomType: true } } } });
}

export async function confirmBreakReturnAction(formData: FormData) {
  const session = await requireManager();
  const id = String(formData.get("reservationId") ?? "");
  const reservation = await getReservation(id, session.organizationId);
  if (!reservation || !["RESERVED_FREE", "CHARGED"].includes(reservation.status)) return;
  const semester = await db.semester.findFirst({ where: { organizationId: session.organizationId, status: "ACTIVE" } });
  if (!semester) return;
  const existing = await db.occupancy.findFirst({ where: { semesterId: semester.id, studentId: reservation.studentId } });
  await db.$transaction(async (tx) => {
    const oldOccupancies = await tx.occupancy.findMany({ where: { organizationId: session.organizationId, studentId: reservation.studentId, status: "ACTIVE", semesterId: { not: semester.id } }, select: { roomId: true } });
    await tx.occupancy.updateMany({ where: { organizationId: session.organizationId, studentId: reservation.studentId, status: "ACTIVE", semesterId: { not: semester.id } }, data: { status: "CHECKED_OUT", checkedOutAt: semester.startDate } });
    if (!existing) {
      const occupancy = await tx.occupancy.create({ data: { organizationId: session.organizationId, semesterId: semester.id, studentId: reservation.studentId, roomId: reservation.roomId, checkInAt: semester.startDate, expectedCheckoutAt: semester.endDate, status: "ACTIVE", checkInCondition: "Continued from free break reservation" } });
      await tx.charge.create({ data: { organizationId: session.organizationId, semesterId: semester.id, studentId: reservation.studentId, occupancyId: occupancy.id, type: "SEMESTER_RENT", description: `${semester.name} rent · Room ${reservation.room.number}`, amount: reservation.room.roomType.semesterRate, dueDate: semester.startDate, status: "UNPAID" } });
    }
    await tx.breakReservation.update({ where: { id }, data: { status: "RETURN_CONFIRMED", returnConfirmedAt: new Date() } });
    await tx.student.update({ where: { id: reservation.studentId }, data: { status: "ACTIVE" } });
    for (const roomId of new Set([...oldOccupancies.map((item) => item.roomId), reservation.roomId])) await refreshRoomStatus(tx, roomId);
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "BREAK_RETURN_CONFIRMED", entityType: "BreakReservation", entityId: id, metadata: { semesterId: semester.id, roomId: reservation.roomId } } });
  });
  revalidatePath("/occupancy"); revalidatePath("/rooms"); revalidatePath("/payments"); revalidatePath("/dashboard");
}
