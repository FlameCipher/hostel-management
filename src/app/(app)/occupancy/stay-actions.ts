"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export type StayFormState = { error: string };

async function requireManager() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/occupancy");
  return session;
}

const checkInSchema = z.object({ studentId: z.string().min(1), semesterId: z.string().min(1), roomId: z.string().min(1), checkInAt: z.string().date(), dueDate: z.string().date(), expectedCheckoutAt: z.string().optional(), checkInCondition: z.string().trim().max(500).optional() });

export async function checkInStudentAction(_state: StayFormState, formData: FormData): Promise<StayFormState> {
  const session = await requireManager();
  const parsed = checkInSchema.safeParse({ studentId: formData.get("studentId"), semesterId: formData.get("semesterId"), roomId: formData.get("roomId"), checkInAt: formData.get("checkInAt"), dueDate: formData.get("dueDate"), expectedCheckoutAt: formData.get("expectedCheckoutAt") || undefined, checkInCondition: formData.get("checkInCondition") || undefined });
  if (!parsed.success) return { error: "Select a student, active semester, available room and valid dates." };
  let occupancyId = "";
  try {
    await db.$transaction(async (tx) => {
      const [student, semester, room, existing] = await Promise.all([
        tx.student.findFirst({ where: { id: parsed.data.studentId, organizationId: session.organizationId, status: { in: ["ACTIVE", "CHECKED_OUT"] } } }),
        tx.semester.findFirst({ where: { id: parsed.data.semesterId, organizationId: session.organizationId, status: "ACTIVE" } }),
        tx.room.findFirst({ where: { id: parsed.data.roomId, organizationId: session.organizationId }, include: { roomType: true, occupancies: { where: { status: "ACTIVE" }, select: { studentId: true } }, breakReservations: { where: { status: "RESERVED_FREE" }, select: { studentId: true } } } }),
        tx.occupancy.findFirst({ where: { organizationId: session.organizationId, studentId: parsed.data.studentId, status: "ACTIVE" } }),
      ]);
      if (!student || !semester || !room) throw new Error("INVALID_SELECTION");
      if (existing) throw new Error("ALREADY_CHECKED_IN");
      if (room.status === "MAINTENANCE" || room.status === "INACTIVE") throw new Error("ROOM_UNAVAILABLE");
      const capacity = room.capacityOverride ?? room.roomType.defaultCapacity;
      const held = new Set([...room.occupancies.map((item) => item.studentId), ...room.breakReservations.map((item) => item.studentId)]);
      const studentHasHold = held.has(student.id);
      if (held.size >= capacity && !studentHasHold) throw new Error("ROOM_FULL");
      const existingSemesterRecord = await tx.occupancy.findFirst({ where: { semesterId: semester.id, studentId: student.id } });
      if (existingSemesterRecord) throw new Error("SEMESTER_DUPLICATE");

      const occupancy = await tx.occupancy.create({ data: { organizationId: session.organizationId, semesterId: semester.id, studentId: student.id, roomId: room.id, checkInAt: new Date(`${parsed.data.checkInAt}T12:00:00.000Z`), expectedCheckoutAt: parsed.data.expectedCheckoutAt ? new Date(`${parsed.data.expectedCheckoutAt}T12:00:00.000Z`) : semester.endDate, status: "ACTIVE", checkInCondition: parsed.data.checkInCondition || null } });
      occupancyId = occupancy.id;
      await tx.charge.create({ data: { organizationId: session.organizationId, semesterId: semester.id, studentId: student.id, occupancyId: occupancy.id, type: "SEMESTER_RENT", description: `${semester.name} rent · Room ${room.number}`, amount: room.roomType.semesterRate, dueDate: new Date(`${parsed.data.dueDate}T12:00:00.000Z`), status: "UNPAID" } });
      await tx.student.update({ where: { id: student.id }, data: { status: "ACTIVE" } });
      await tx.breakReservation.updateMany({ where: { organizationId: session.organizationId, studentId: student.id, roomId: room.id, status: "RESERVED_FREE" }, data: { status: "RETURN_CONFIRMED", returnConfirmedAt: new Date() } });
      const nextHeld = studentHasHold ? held.size : held.size + 1;
      await tx.room.update({ where: { id: room.id }, data: { status: nextHeld >= capacity ? "FULL" : "PARTIALLY_OCCUPIED" } });
      await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "STUDENT_CHECKED_IN", entityType: "Occupancy", entityId: occupancy.id, metadata: { studentId: student.id, roomId: room.id, semesterId: semester.id, rent: Number(room.roomType.semesterRate) } } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = { INVALID_SELECTION: "The student, semester or room is unavailable.", ALREADY_CHECKED_IN: "This student already has an active room.", ROOM_UNAVAILABLE: "This room is unavailable.", ROOM_FULL: "This room has reached capacity.", SEMESTER_DUPLICATE: "This student already has an occupancy record for the active semester." };
    if (messages[code]) return { error: messages[code] };
    throw error;
  }
  revalidatePath("/occupancy"); revalidatePath("/rooms"); revalidatePath("/students"); revalidatePath(`/students/${parsed.data.studentId}/edit`); revalidatePath("/payments"); revalidatePath("/dashboard");
  redirect(`/occupancy/${occupancyId}`);
}

const transferSchema = z.object({ targetRoomId: z.string().min(1), reason: z.string().trim().min(5).max(300) });
export async function transferRoomAction(occupancyId: string, _state: StayFormState, formData: FormData): Promise<StayFormState> {
  const session = await requireManager();
  const parsed = transferSchema.safeParse({ targetRoomId: formData.get("targetRoomId"), reason: formData.get("reason") });
  if (!parsed.success) return { error: "Select a room and provide a transfer reason." };
  const occupancy = await db.occupancy.findFirst({ where: { id: occupancyId, organizationId: session.organizationId, status: "ACTIVE" } });
  const target = await db.room.findFirst({ where: { id: parsed.data.targetRoomId, organizationId: session.organizationId }, include: { roomType: true, occupancies: { where: { status: "ACTIVE" }, select: { studentId: true } }, breakReservations: { where: { status: "RESERVED_FREE" }, select: { studentId: true } } } });
  if (!occupancy || !target) return { error: "The occupancy or target room is unavailable." };
  if (occupancy.roomId === target.id) return { error: "Select a different room." };
  if (["MAINTENANCE", "INACTIVE"].includes(target.status)) return { error: "The selected room is unavailable." };
  const capacity = target.capacityOverride ?? target.roomType.defaultCapacity;
  const held = new Set([...target.occupancies.map((item) => item.studentId), ...target.breakReservations.map((item) => item.studentId)]);
  if (held.size >= capacity && !held.has(occupancy.studentId)) return { error: "The selected room is full." };
  await db.$transaction([
    db.occupancy.update({ where: { id: occupancy.id }, data: { roomId: target.id } }),
    db.breakReservation.updateMany({ where: { organizationId: session.organizationId, studentId: occupancy.studentId, roomId: occupancy.roomId, status: "RESERVED_FREE" }, data: { roomId: target.id } }),
    db.room.update({ where: { id: target.id }, data: { status: held.size + (held.has(occupancy.studentId) ? 0 : 1) >= capacity ? "FULL" : "PARTIALLY_OCCUPIED" } }),
    db.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "ROOM_TRANSFERRED", entityType: "Occupancy", entityId: occupancy.id, metadata: { fromRoomId: occupancy.roomId, toRoomId: target.id, reason: parsed.data.reason } } }),
  ]);
  const oldRemaining = await db.occupancy.count({ where: { roomId: occupancy.roomId, status: "ACTIVE" } });
  await db.room.update({ where: { id: occupancy.roomId }, data: { status: oldRemaining ? "PARTIALLY_OCCUPIED" : "VACANT" } });
  revalidatePath("/occupancy"); revalidatePath("/rooms"); revalidatePath(`/occupancy/${occupancy.id}`); redirect(`/occupancy/${occupancy.id}`);
}

const checkoutSchema = z.object({ checkedOutAt: z.string().date(), checkoutCondition: z.string().trim().min(3).max(500), overrideBalance: z.boolean(), overrideReason: z.string().trim().max(300).optional() });
export async function checkoutStudentAction(occupancyId: string, _state: StayFormState, formData: FormData): Promise<StayFormState> {
  const session = await requireManager();
  const parsed = checkoutSchema.safeParse({ checkedOutAt: formData.get("checkedOutAt"), checkoutCondition: formData.get("checkoutCondition"), overrideBalance: formData.get("overrideBalance") === "on", overrideReason: formData.get("overrideReason") || undefined });
  if (!parsed.success) return { error: "Enter the checkout date and room condition." };
  const occupancy = await db.occupancy.findFirst({ where: { id: occupancyId, organizationId: session.organizationId, status: "ACTIVE" }, include: { student: true, propertyItems: true, room: { include: { assets: { where: { active: true } } } } } });
  if (!occupancy) return { error: "This active occupancy could not be found." };
  const activeBreakHold = await db.breakReservation.findFirst({ where: { organizationId: session.organizationId, studentId: occupancy.studentId, status: "RESERVED_FREE" } });
  if (activeBreakHold) return { error: "Resolve the student’s active break reservation before checkout." };
  const charges = await db.charge.findMany({ where: { organizationId: session.organizationId, studentId: occupancy.studentId, status: { not: "WAIVED" } }, include: { payments: { where: { reversedAt: null } } } });
  const balance = charges.reduce((sum, charge) => sum + Math.max(0, Number(charge.amount) - charge.payments.reduce((paid, item) => paid + Number(item.amount), 0)), 0);
  if (balance > 0 && !parsed.data.overrideBalance) return { error: `Outstanding balance is KES ${balance.toLocaleString("en-KE")}. Record payment or use an authorised override.` };
  if (balance > 0 && !["OWNER", "ADMIN"].includes(session.role)) return { error: "Only Owner or Admin can clear a student with an outstanding balance." };
  if (balance > 0 && (!parsed.data.overrideReason || parsed.data.overrideReason.length < 8)) return { error: "Provide an override reason of at least 8 characters." };
  const conditions = new Set(["NEW", "GOOD", "FAIR", "DAMAGED", "MISSING", "NOT_APPLICABLE"]);
  const propertyConditions = occupancy.propertyItems.map((item) => ({ id: item.id, condition: String(formData.get(`propertyCondition:${item.id}`) ?? "") }));
  const assetConditions = occupancy.room.assets.map((item) => ({ id: item.id, condition: String(formData.get(`assetCondition:${item.id}`) ?? "") }));
  if ([...propertyConditions, ...assetConditions].some((item) => !conditions.has(item.condition))) return { error: "Record the checkout condition for every student item and hostel asset." };
  await db.$transaction([
    db.occupancy.update({ where: { id: occupancy.id }, data: { status: "CHECKED_OUT", checkedOutAt: new Date(`${parsed.data.checkedOutAt}T12:00:00.000Z`), checkoutCondition: parsed.data.checkoutCondition, finalBalance: balance, clearanceStatus: "CLEARED" } }),
    db.student.update({ where: { id: occupancy.studentId }, data: { status: "CHECKED_OUT" } }),
    ...propertyConditions.map((item) => db.studentPropertyItem.update({ where: { id: item.id }, data: { checkoutCondition: item.condition as "NEW" | "GOOD" | "FAIR" | "DAMAGED" | "MISSING" | "NOT_APPLICABLE" } })),
    ...assetConditions.map((item) => db.hostelAsset.update({ where: { id: item.id }, data: { condition: item.condition as "NEW" | "GOOD" | "FAIR" | "DAMAGED" | "MISSING" | "NOT_APPLICABLE" } })),
    db.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: balance > 0 ? "CHECKOUT_CLEARED_WITH_OVERRIDE" : "STUDENT_CHECKED_OUT", entityType: "Occupancy", entityId: occupancy.id, metadata: { balance, overrideReason: parsed.data.overrideReason || null } } }),
  ]);
  const remaining = await db.occupancy.count({ where: { roomId: occupancy.roomId, status: "ACTIVE" } });
  await db.room.update({ where: { id: occupancy.roomId }, data: { status: remaining ? "PARTIALLY_OCCUPIED" : "VACANT" } });
  revalidatePath("/occupancy"); revalidatePath("/rooms"); revalidatePath("/students"); revalidatePath("/student-property"); revalidatePath("/assets"); revalidatePath("/dashboard"); redirect(`/occupancy/${occupancy.id}/clearance`);
}
