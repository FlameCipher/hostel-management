"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

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
  const potentialCharge = Number(occupancy.room.roomType.monthlyRate) * period.months;
  await db.breakReservation.upsert({
    where: { breakPeriodId_studentId: { breakPeriodId: period.id, studentId: occupancy.studentId } },
    create: {
      organizationId: session.organizationId, breakPeriodId: period.id, studentId: occupancy.studentId, roomId: occupancy.roomId,
      intent: parsed.data.intent, status: parsed.data.intent === "RETURNING" ? "RESERVED_FREE" : "CLEARANCE_REQUIRED",
      belongingsStored: parsed.data.belongingsStored, monthlyRateSnapshot: occupancy.room.roomType.monthlyRate,
      potentialCharge, declaredAt: new Date(), notes: parsed.data.notes || null,
    },
    update: {
      roomId: occupancy.roomId, intent: parsed.data.intent, status: parsed.data.intent === "RETURNING" ? "RESERVED_FREE" : "CLEARANCE_REQUIRED",
      belongingsStored: parsed.data.belongingsStored, monthlyRateSnapshot: occupancy.room.roomType.monthlyRate,
      potentialCharge, declaredAt: new Date(), notes: parsed.data.notes || null,
    },
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
  if (!reservation || reservation.status !== "RESERVED_FREE") return;
  const semester = await db.semester.findFirst({ where: { organizationId: session.organizationId, status: "ACTIVE" } });
  if (!semester) return;
  const existing = await db.occupancy.findFirst({ where: { semesterId: semester.id, studentId: reservation.studentId } });
  await db.$transaction(async (tx) => {
    await tx.occupancy.updateMany({ where: { organizationId: session.organizationId, studentId: reservation.studentId, status: "ACTIVE", semesterId: { not: semester.id } }, data: { status: "CHECKED_OUT", checkedOutAt: semester.startDate } });
    if (!existing) {
      const occupancy = await tx.occupancy.create({ data: { organizationId: session.organizationId, semesterId: semester.id, studentId: reservation.studentId, roomId: reservation.roomId, checkInAt: semester.startDate, expectedCheckoutAt: semester.endDate, status: "ACTIVE", checkInCondition: "Continued from free break reservation" } });
      await tx.charge.create({ data: { organizationId: session.organizationId, semesterId: semester.id, studentId: reservation.studentId, occupancyId: occupancy.id, type: "SEMESTER_RENT", description: `${semester.name} rent · Room ${reservation.room.number}`, amount: reservation.room.roomType.semesterRate, dueDate: semester.startDate, status: "UNPAID" } });
    }
    await tx.breakReservation.update({ where: { id }, data: { status: "RETURN_CONFIRMED", returnConfirmedAt: new Date() } });
    await tx.student.update({ where: { id: reservation.studentId }, data: { status: "ACTIVE" } });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "BREAK_RETURN_CONFIRMED", entityType: "BreakReservation", entityId: id, metadata: { semesterId: semester.id, roomId: reservation.roomId } } });
  });
  revalidatePath("/occupancy"); revalidatePath("/rooms"); revalidatePath("/payments"); revalidatePath("/dashboard");
}

export async function clearBreakReservationAction(formData: FormData) {
  const session = await requireManager();
  const id = String(formData.get("reservationId") ?? "");
  const reservation = await getReservation(id, session.organizationId);
  if (!reservation || reservation.status !== "CLEARANCE_REQUIRED") return;
  await db.breakReservation.update({ where: { id }, data: { status: "VACATED_CLEARED", clearedAt: new Date() } });
  revalidatePath("/occupancy"); revalidatePath("/rooms");
}

export async function cancelBreakReturnAction(formData: FormData) {
  const session = await requireManager();
  const id = String(formData.get("reservationId") ?? "");
  const reservation = await getReservation(id, session.organizationId);
  if (!reservation || reservation.status !== "RESERVED_FREE") return;
  const shouldCharge = reservation.belongingsStored;
  await db.$transaction(async (tx) => {
    await tx.breakReservation.update({ where: { id }, data: { status: shouldCharge ? "CHARGED" : "VACATED_CLEARED", clearedAt: new Date() } });
    if (shouldCharge) {
      await tx.charge.upsert({
        where: { breakReservationId: id },
        create: {
          organizationId: session.organizationId, studentId: reservation.studentId, breakReservationId: id,
          type: "BREAK_ACCOMMODATION", description: `${reservation.breakPeriod.name} belongings accommodation`,
          amount: reservation.potentialCharge, dueDate: new Date(), status: "UNPAID",
        },
        update: { amount: reservation.potentialCharge, dueDate: new Date(), status: "UNPAID" },
      });
    }
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: shouldCharge ? "BREAK_RESERVATION_CHARGED" : "BREAK_RESERVATION_RELEASED_NO_CHARGE", entityType: "BreakReservation", entityId: id, metadata: { belongingsStored: reservation.belongingsStored, amount: shouldCharge ? Number(reservation.potentialCharge) : 0 } } });
  });
  revalidatePath("/occupancy"); revalidatePath("/rooms"); revalidatePath("/payments");
}
