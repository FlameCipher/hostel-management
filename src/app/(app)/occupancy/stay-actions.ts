"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deliverPaymentReceipt } from "@/lib/receipt-delivery";
import { addUtcDays, applyChargeAmount, calculateActualDaysRent } from "@/lib/rent-calculation";
import { activeBreakHoldWhere, refreshRoomStatus } from "@/lib/room-status";

export type StayFormState = { error: string };

async function requireManager() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/occupancy");
  return session;
}

const checkInSchema = z.object({ paymentId: z.string().optional(), studentId: z.string().min(1), semesterId: z.string().min(1), roomId: z.string().min(1), checkInAt: z.string().date(), dueDate: z.string().date(), expectedCheckoutAt: z.string().optional(), checkInCondition: z.string().trim().max(500).optional(), rentMethod: z.enum(["KEEP_FULL", "ACTUAL_DAYS", "CUSTOM"]), customRent: z.coerce.number().min(0).max(4_000_000).optional(), rentAdjustmentReason: z.string().trim().max(300).optional() });

export async function checkInStudentAction(_state: StayFormState, formData: FormData): Promise<StayFormState> {
  const session = await requireManager();
  const customValue = formData.get("customRent");
  const parsed = checkInSchema.safeParse({ paymentId: formData.get("paymentId") || undefined, studentId: formData.get("studentId"), semesterId: formData.get("semesterId"), roomId: formData.get("roomId"), checkInAt: formData.get("checkInAt"), dueDate: formData.get("dueDate"), expectedCheckoutAt: formData.get("expectedCheckoutAt") || undefined, checkInCondition: formData.get("checkInCondition") || undefined, rentMethod: formData.get("rentMethod"), customRent: customValue === "" || customValue === null ? undefined : customValue, rentAdjustmentReason: formData.get("rentAdjustmentReason") || undefined });
  if (!parsed.success) return { error: "Select a student, active semester, available room and valid dates." };
  if (parsed.data.rentMethod === "CUSTOM" && parsed.data.customRent === undefined) return { error: "Enter the agreed final semester rent." };
  if (parsed.data.rentMethod === "CUSTOM" && !["OWNER", "ADMIN"].includes(session.role)) return { error: "Only the Owner or Admin can enter custom final rent." };
  if (parsed.data.rentMethod !== "KEEP_FULL" && (!parsed.data.rentAdjustmentReason || parsed.data.rentAdjustmentReason.length < 5)) return { error: "Provide a reason for recalculating the student’s rent." };
  const checkInDate = new Date(`${parsed.data.checkInAt}T12:00:00.000Z`);
  let receiptPaymentId = "";
  try {
    await db.$transaction(async (tx) => {
      const [student, semester, room, existing, initialPayment] = await Promise.all([
        tx.student.findFirst({ where: { id: parsed.data.studentId, organizationId: session.organizationId, status: { in: ["ACTIVE", "CHECKED_OUT"] } } }),
        tx.semester.findFirst({ where: { id: parsed.data.semesterId, organizationId: session.organizationId, status: "ACTIVE" } }),
        tx.room.findFirst({ where: { id: parsed.data.roomId, organizationId: session.organizationId }, include: { roomType: true, occupancies: { where: { status: "ACTIVE" }, select: { studentId: true } }, breakReservations: { where: activeBreakHoldWhere, select: { studentId: true } } } }),
        tx.occupancy.findFirst({ where: { organizationId: session.organizationId, studentId: parsed.data.studentId, status: "ACTIVE" } }),
        tx.payment.findFirst({
          where: {
            ...(parsed.data.paymentId ? { id: parsed.data.paymentId } : {}),
            organizationId: session.organizationId,
            studentId: parsed.data.studentId,
            reversedAt: null,
            charge: { semesterId: parsed.data.semesterId, type: "SEMESTER_RENT", occupancyId: null },
          },
          include: { charge: true },
          orderBy: { paidAt: "desc" },
        }),
      ]);
      if (!student || !semester || !room) throw new Error("INVALID_SELECTION");
      if (checkInDate < semester.startDate || checkInDate > semester.endDate) throw new Error("INVALID_CHECK_IN_DATE");
      if (!initialPayment) throw new Error("INITIAL_PAYMENT_REQUIRED");
      if (existing) throw new Error("ALREADY_CHECKED_IN");
      if (room.status === "MAINTENANCE" || room.status === "INACTIVE") throw new Error("ROOM_UNAVAILABLE");
      if (initialPayment.charge.roomTypeId && initialPayment.charge.roomTypeId !== room.roomTypeId) throw new Error("ROOM_TYPE_MISMATCH");
      const capacity = room.capacityOverride ?? room.roomType.defaultCapacity;
      const held = new Set([...room.occupancies.map((item) => item.studentId), ...room.breakReservations.map((item) => item.studentId)]);
      const studentHasHold = held.has(student.id);
      if (held.size >= capacity && !studentHasHold) throw new Error("ROOM_FULL");
      const existingSemesterRecord = await tx.occupancy.findFirst({ where: { semesterId: semester.id, studentId: student.id } });
      if (existingSemesterRecord) throw new Error("SEMESTER_DUPLICATE");

      const occupancy = await tx.occupancy.create({ data: { organizationId: session.organizationId, semesterId: semester.id, studentId: student.id, roomId: room.id, checkInAt: checkInDate, expectedCheckoutAt: parsed.data.expectedCheckoutAt ? new Date(`${parsed.data.expectedCheckoutAt}T12:00:00.000Z`) : semester.endDate, status: "ACTIVE", checkInCondition: parsed.data.checkInCondition || null } });
      await tx.occupancyRoomStay.create({ data: { organizationId: session.organizationId, occupancyId: occupancy.id, roomId: room.id, roomTypeId: room.roomTypeId, startDate: occupancy.checkInAt, monthlyRateSnapshot: room.roomType.monthlyRate, semesterRateSnapshot: room.roomType.semesterRate } });
      receiptPaymentId = initialPayment.id;
      await tx.charge.update({ where: { id: initialPayment.charge.id }, data: { occupancyId: occupancy.id, roomTypeId: room.roomTypeId, baseAmount: initialPayment.charge.baseAmount ?? initialPayment.charge.amount, description: `${semester.name} rent · Room ${room.number}`, dueDate: new Date(`${parsed.data.dueDate}T12:00:00.000Z`) } });
      let rentAdjustment: Awaited<ReturnType<typeof applyChargeAmount>> | null = null;
      if (parsed.data.rentMethod !== "KEEP_FULL") {
        const calculation = parsed.data.rentMethod === "ACTUAL_DAYS" ? calculateActualDaysRent({ semesterStart: semester.startDate, semesterEnd: semester.endDate, segments: [{ roomId: room.id, roomTypeId: room.roomTypeId, startDate: checkInDate, endDate: addUtcDays(semester.endDate, 1), semesterRate: Number(room.roomType.semesterRate) }] }) : null;
        const newAmount = calculation?.amount ?? parsed.data.customRent ?? Number(initialPayment.charge.amount);
        rentAdjustment = await applyChargeAmount(tx, { organizationId: session.organizationId, chargeId: initialPayment.charge.id, createdById: session.userId, reason: "LATE_CHECK_IN", calculationMethod: parsed.data.rentMethod, newAmount, effectiveDate: checkInDate, explanation: parsed.data.rentAdjustmentReason ?? "Approved late check-in rent recalculation", calculationData: calculation ? { totalDays: calculation.totalDays, checkInDate: checkInDate.toISOString(), semesterRate: Number(room.roomType.semesterRate), occupiedDays: calculation.lines[0]?.days ?? 0 } : { customRent: parsed.data.customRent ?? null } });
      }
      await tx.student.update({ where: { id: student.id }, data: { status: "ACTIVE" } });
      await tx.breakReservation.updateMany({ where: { organizationId: session.organizationId, studentId: student.id, roomId: room.id, ...activeBreakHoldWhere }, data: { status: "RETURN_CONFIRMED", returnConfirmedAt: new Date() } });
      await refreshRoomStatus(tx, room.id);
      await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "STUDENT_CHECKED_IN", entityType: "Occupancy", entityId: occupancy.id, metadata: { studentId: student.id, roomId: room.id, semesterId: semester.id, initialPaymentId: initialPayment.id, chargeId: initialPayment.charge.id, rentMethod: parsed.data.rentMethod, previousRent: rentAdjustment?.previousAmount ?? Number(initialPayment.charge.amount), finalRent: rentAdjustment?.newAmount ?? Number(initialPayment.charge.amount), credit: rentAdjustment?.credit ?? 0, rentAdjustmentReason: parsed.data.rentAdjustmentReason ?? null } } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = { INVALID_SELECTION: "The student, semester or room is unavailable.", INVALID_CHECK_IN_DATE: "The check-in date must fall within the active semester.", INITIAL_PAYMENT_REQUIRED: "Record an initial payment before allocating a room.", ALREADY_CHECKED_IN: "This student already has an active room.", ROOM_UNAVAILABLE: "This room is unavailable.", ROOM_TYPE_MISMATCH: "Select a room matching the accommodation type chosen during registration.", ROOM_FULL: "This room has reached capacity.", SEMESTER_DUPLICATE: "This student already has an occupancy record for the active semester." };
    if (messages[code]) return { error: messages[code] };
    throw error;
  }
  revalidatePath("/occupancy"); revalidatePath("/rooms"); revalidatePath("/students"); revalidatePath(`/students/${parsed.data.studentId}/edit`); revalidatePath("/payments"); revalidatePath("/dashboard");
  const delivery = await deliverPaymentReceipt(receiptPaymentId, session.organizationId);
  revalidatePath(`/payments/${receiptPaymentId}/receipt`);
  redirect(`/payments/${receiptPaymentId}/receipt?delivery=${delivery}`);
}

const transferSchema = z.object({
  targetRoomId: z.string().min(1),
  transferDate: z.string().date(),
  rentMethod: z.enum(["KEEP_FULL", "ACTUAL_DAYS", "CUSTOM"]),
  customRent: z.coerce.number().min(0).max(4_000_000).optional(),
  reason: z.string().trim().min(5).max(300),
});
export async function transferRoomAction(occupancyId: string, _state: StayFormState, formData: FormData): Promise<StayFormState> {
  const session = await requireManager();
  const customValue = formData.get("customRent");
  const parsed = transferSchema.safeParse({ targetRoomId: formData.get("targetRoomId"), transferDate: formData.get("transferDate"), rentMethod: formData.get("rentMethod"), customRent: customValue === "" || customValue === null ? undefined : customValue, reason: formData.get("reason") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Select a room, transfer date and rent calculation method." };
  if (parsed.data.rentMethod === "CUSTOM" && parsed.data.customRent === undefined) return { error: "Enter the agreed final semester rent." };
  if (parsed.data.rentMethod === "CUSTOM" && !["OWNER", "ADMIN"].includes(session.role)) return { error: "Only the Owner or Admin can enter a custom final rent." };
  const transferDate = new Date(`${parsed.data.transferDate}T12:00:00.000Z`);
  try {
    await db.$transaction(async (tx) => {
      const [occupancy, target] = await Promise.all([
        tx.occupancy.findFirst({ where: { id: occupancyId, organizationId: session.organizationId, status: "ACTIVE" }, include: { semester: true, room: { include: { roomType: true } }, roomStays: { orderBy: { startDate: "asc" } }, charges: { where: { type: "SEMESTER_RENT" }, orderBy: { createdAt: "asc" } } } }),
        tx.room.findFirst({ where: { id: parsed.data.targetRoomId, organizationId: session.organizationId }, include: { roomType: true, occupancies: { where: { status: "ACTIVE" }, select: { studentId: true } }, breakReservations: { where: activeBreakHoldWhere, select: { studentId: true } } } }),
      ]);
      if (!occupancy || !target) throw new Error("TRANSFER_UNAVAILABLE");
      if (occupancy.roomId === target.id) throw new Error("SAME_ROOM");
      if (["MAINTENANCE", "INACTIVE"].includes(target.status)) throw new Error("ROOM_UNAVAILABLE");
      if (transferDate <= occupancy.checkInAt || transferDate > occupancy.semester.endDate) throw new Error("INVALID_TRANSFER_DATE");
      const capacity = target.capacityOverride ?? target.roomType.defaultCapacity;
      const held = new Set([...target.occupancies.map((item) => item.studentId), ...target.breakReservations.map((item) => item.studentId)]);
      if (held.size >= capacity && !held.has(occupancy.studentId)) throw new Error("ROOM_FULL");
      const charge = occupancy.charges[0];
      if (!charge) throw new Error("RENT_CHARGE_NOT_FOUND");

      let stays = occupancy.roomStays;
      if (!stays.length) {
        const opening = await tx.occupancyRoomStay.create({ data: { organizationId: session.organizationId, occupancyId: occupancy.id, roomId: occupancy.roomId, roomTypeId: occupancy.room.roomTypeId, startDate: occupancy.checkInAt, monthlyRateSnapshot: occupancy.room.roomType.monthlyRate, semesterRateSnapshot: occupancy.room.roomType.semesterRate } });
        stays = [opening];
      }
      const openStay = stays.find((stay) => !stay.endDate);
      if (!openStay) throw new Error("ACTIVE_STAY_NOT_FOUND");
      await tx.occupancyRoomStay.update({ where: { id: openStay.id }, data: { endDate: transferDate } });
      await tx.occupancyRoomStay.create({ data: { organizationId: session.organizationId, occupancyId: occupancy.id, roomId: target.id, roomTypeId: target.roomTypeId, startDate: transferDate, monthlyRateSnapshot: target.roomType.monthlyRate, semesterRateSnapshot: target.roomType.semesterRate } });

      let calculation: ReturnType<typeof calculateActualDaysRent> | null = null;
      let newAmount = Number(charge.amount);
      if (parsed.data.rentMethod === "ACTUAL_DAYS") {
        calculation = calculateActualDaysRent({
          semesterStart: occupancy.semester.startDate,
          semesterEnd: occupancy.semester.endDate,
          segments: [
            ...stays.filter((stay) => stay.id !== openStay.id).map((stay) => ({ roomId: stay.roomId, roomTypeId: stay.roomTypeId, startDate: stay.startDate, endDate: stay.endDate ?? transferDate, semesterRate: Number(stay.semesterRateSnapshot) })),
            { roomId: openStay.roomId, roomTypeId: openStay.roomTypeId, startDate: openStay.startDate, endDate: transferDate, semesterRate: Number(openStay.semesterRateSnapshot) },
            { roomId: target.id, roomTypeId: target.roomTypeId, startDate: transferDate, endDate: addUtcDays(occupancy.semester.endDate, 1), semesterRate: Number(target.roomType.semesterRate) },
          ],
        });
        newAmount = calculation.amount;
      } else if (parsed.data.rentMethod === "CUSTOM") newAmount = parsed.data.customRent ?? newAmount;

      const adjustment = await applyChargeAmount(tx, { organizationId: session.organizationId, chargeId: charge.id, createdById: session.userId, reason: "ROOM_TRANSFER", calculationMethod: parsed.data.rentMethod, newAmount, effectiveDate: transferDate, explanation: parsed.data.reason, calculationData: calculation ? { totalDays: calculation.totalDays, lines: calculation.lines.map((line) => ({ roomId: line.roomId, roomTypeId: line.roomTypeId, startDate: line.startDate.toISOString(), endDate: line.endDate.toISOString(), days: line.days, semesterRate: line.semesterRate, amount: line.amount })) } : { customRent: parsed.data.customRent ?? null } });
      await tx.occupancy.update({ where: { id: occupancy.id }, data: { roomId: target.id } });
      await tx.breakReservation.updateMany({ where: { organizationId: session.organizationId, studentId: occupancy.studentId, roomId: occupancy.roomId, ...activeBreakHoldWhere }, data: { roomId: target.id } });
      await refreshRoomStatus(tx, occupancy.roomId);
      await refreshRoomStatus(tx, target.id);
      await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "ROOM_TRANSFERRED", entityType: "Occupancy", entityId: occupancy.id, metadata: { fromRoomId: occupancy.roomId, toRoomId: target.id, transferDate: transferDate.toISOString(), rentMethod: parsed.data.rentMethod, previousRent: adjustment.previousAmount, newRent: adjustment.newAmount, credit: adjustment.credit, reason: parsed.data.reason } } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = { TRANSFER_UNAVAILABLE: "The occupancy or target room is unavailable.", SAME_ROOM: "Select a different room.", ROOM_UNAVAILABLE: "The selected room is unavailable.", INVALID_TRANSFER_DATE: "The transfer date must be after check-in and within the semester.", ROOM_FULL: "The selected room is full.", RENT_CHARGE_NOT_FOUND: "The semester rent charge could not be found.", ACTIVE_STAY_NOT_FOUND: "The active room-stay record could not be found." };
    if (messages[code]) return { error: messages[code] };
    throw error;
  }
  revalidatePath("/occupancy"); revalidatePath("/rooms"); revalidatePath("/payments"); revalidatePath("/dashboard"); revalidatePath(`/occupancy/${occupancyId}`); redirect(`/occupancy/${occupancyId}`);
}

const checkoutSchema = z.object({ checkedOutAt: z.string().date(), checkoutCondition: z.string().trim().min(3).max(500), rentMethod: z.enum(["KEEP_FULL", "ACTUAL_DAYS", "CUSTOM"]), customRent: z.coerce.number().min(0).max(4_000_000).optional(), rentAdjustmentReason: z.string().trim().max(300).optional(), overrideBalance: z.boolean(), overrideReason: z.string().trim().max(300).optional() });
export async function checkoutStudentAction(occupancyId: string, _state: StayFormState, formData: FormData): Promise<StayFormState> {
  const session = await requireManager();
  const customValue = formData.get("customRent");
  const parsed = checkoutSchema.safeParse({ checkedOutAt: formData.get("checkedOutAt"), checkoutCondition: formData.get("checkoutCondition"), rentMethod: formData.get("rentMethod"), customRent: customValue === "" || customValue === null ? undefined : customValue, rentAdjustmentReason: formData.get("rentAdjustmentReason") || undefined, overrideBalance: formData.get("overrideBalance") === "on", overrideReason: formData.get("overrideReason") || undefined });
  if (!parsed.success) return { error: "Enter the checkout date and room condition." };
  if (parsed.data.rentMethod === "CUSTOM" && parsed.data.customRent === undefined) return { error: "Enter the agreed final semester rent." };
  if (parsed.data.rentMethod === "CUSTOM" && !["OWNER", "ADMIN"].includes(session.role)) return { error: "Only the Owner or Admin can enter custom final rent." };
  if (parsed.data.rentMethod !== "KEEP_FULL" && (!parsed.data.rentAdjustmentReason || parsed.data.rentAdjustmentReason.length < 5)) return { error: "Provide a reason for recalculating the rent." };
  const occupancy = await db.occupancy.findFirst({ where: { id: occupancyId, organizationId: session.organizationId, status: "ACTIVE" }, include: { student: true, semester: true, roomStays: { orderBy: { startDate: "asc" } }, charges: { where: { type: "SEMESTER_RENT" }, orderBy: { createdAt: "asc" } }, propertyItems: true, room: { include: { roomType: true, assets: { where: { active: true } } } } } });
  if (!occupancy) return { error: "This active occupancy could not be found." };
  const checkoutDate = new Date(`${parsed.data.checkedOutAt}T12:00:00.000Z`);
  if (checkoutDate < occupancy.checkInAt || checkoutDate > addUtcDays(occupancy.semester.endDate, 1)) return { error: "The checkout date must be within the student’s stay and semester." };
  const conditions = new Set(["NEW", "GOOD", "FAIR", "DAMAGED", "MISSING", "NOT_APPLICABLE"]);
  const propertyConditions = occupancy.propertyItems.map((item) => ({ id: item.id, condition: String(formData.get(`propertyCondition:${item.id}`) ?? "") }));
  const assetConditions = occupancy.room.assets.map((item) => ({ id: item.id, condition: String(formData.get(`assetCondition:${item.id}`) ?? "") }));
  if ([...propertyConditions, ...assetConditions].some((item) => !conditions.has(item.condition))) return { error: "Record the checkout condition for every student item and hostel asset." };
  try {
    await db.$transaction(async (tx) => {
      const rentCharge = occupancy.charges[0];
      let rentResult: Awaited<ReturnType<typeof applyChargeAmount>> | null = null;
      if (rentCharge && parsed.data.rentMethod !== "KEEP_FULL") {
        let newAmount = Number(rentCharge.amount);
        let calculation: ReturnType<typeof calculateActualDaysRent> | null = null;
        if (parsed.data.rentMethod === "ACTUAL_DAYS") {
          const checkoutEndExclusive = addUtcDays(checkoutDate, 1);
          const stays = occupancy.roomStays.length ? occupancy.roomStays : [{ id: "opening", roomId: occupancy.roomId, roomTypeId: occupancy.room.roomTypeId, startDate: occupancy.checkInAt, endDate: null, semesterRateSnapshot: occupancy.room.roomType.semesterRate }];
          calculation = calculateActualDaysRent({ semesterStart: occupancy.semester.startDate, semesterEnd: occupancy.semester.endDate, segments: stays.map((stay) => ({ roomId: stay.roomId, roomTypeId: stay.roomTypeId, startDate: stay.startDate, endDate: stay.endDate && stay.endDate < checkoutEndExclusive ? stay.endDate : checkoutEndExclusive, semesterRate: Number(stay.semesterRateSnapshot) })) });
          newAmount = calculation.amount;
        } else newAmount = parsed.data.customRent ?? newAmount;
        rentResult = await applyChargeAmount(tx, { organizationId: session.organizationId, chargeId: rentCharge.id, createdById: session.userId, reason: "EARLY_CHECKOUT", calculationMethod: parsed.data.rentMethod, newAmount, effectiveDate: checkoutDate, explanation: parsed.data.rentAdjustmentReason ?? "Approved checkout rent recalculation", calculationData: calculation ? { totalDays: calculation.totalDays, lines: calculation.lines.map((line) => ({ roomId: line.roomId, roomTypeId: line.roomTypeId, startDate: line.startDate.toISOString(), endDate: line.endDate.toISOString(), days: line.days, semesterRate: line.semesterRate, amount: line.amount })) } : { customRent: parsed.data.customRent ?? null } });
      }
      const checkoutEndExclusive = addUtcDays(checkoutDate, 1);
      await tx.occupancyRoomStay.updateMany({ where: { occupancyId: occupancy.id, endDate: null }, data: { endDate: checkoutEndExclusive } });
      const charges = await tx.charge.findMany({ where: { organizationId: session.organizationId, studentId: occupancy.studentId, status: { not: "WAIVED" } }, include: { payments: { where: { reversedAt: null } } } });
      const netPosition = charges.reduce((sum, charge) => sum + Number(charge.amount) - charge.payments.reduce((paid, item) => paid + Number(item.amount), 0), 0);
      const balance = Math.max(0, netPosition);
      const credit = Math.max(0, -netPosition);
      if (balance > 0 && !parsed.data.overrideBalance) throw new Error(`OUTSTANDING_BALANCE:${balance}`);
      if (balance > 0 && !["OWNER", "ADMIN"].includes(session.role)) throw new Error("BALANCE_OVERRIDE_FORBIDDEN");
      if (balance > 0 && (!parsed.data.overrideReason || parsed.data.overrideReason.length < 8)) throw new Error("OVERRIDE_REASON_REQUIRED");
      await tx.occupancy.update({ where: { id: occupancy.id }, data: { status: "CHECKED_OUT", checkedOutAt: checkoutDate, checkoutCondition: parsed.data.checkoutCondition, finalBalance: netPosition, clearanceStatus: "CLEARED" } });
      await tx.student.update({ where: { id: occupancy.studentId }, data: { status: "CHECKED_OUT" } });
      await tx.breakReservation.updateMany({ where: { organizationId: session.organizationId, studentId: occupancy.studentId, status: { in: ["RESERVED_FREE", "CHARGED", "CLEARANCE_REQUIRED"] }, clearedAt: null }, data: { status: "VACATED_CLEARED", clearedAt: new Date() } });
      for (const item of propertyConditions) await tx.studentPropertyItem.update({ where: { id: item.id }, data: { checkoutCondition: item.condition as "NEW" | "GOOD" | "FAIR" | "DAMAGED" | "MISSING" | "NOT_APPLICABLE" } });
      for (const item of assetConditions) await tx.hostelAsset.update({ where: { id: item.id }, data: { condition: item.condition as "NEW" | "GOOD" | "FAIR" | "DAMAGED" | "MISSING" | "NOT_APPLICABLE" } });
      await refreshRoomStatus(tx, occupancy.roomId);
      await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: balance > 0 ? "CHECKOUT_CLEARED_WITH_OVERRIDE" : "STUDENT_CHECKED_OUT", entityType: "Occupancy", entityId: occupancy.id, metadata: { balance, credit, rentMethod: parsed.data.rentMethod, previousRent: rentResult?.previousAmount ?? null, finalRent: rentResult?.newAmount ?? Number(rentCharge?.amount ?? 0), overrideReason: parsed.data.overrideReason || null } } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code.startsWith("OUTSTANDING_BALANCE:")) return { error: `Outstanding balance is KES ${Number(code.split(":")[1]).toLocaleString("en-KE")}. Record payment or use an authorised override.` };
    if (code === "BALANCE_OVERRIDE_FORBIDDEN") return { error: "Only Owner or Admin can clear a student with an outstanding balance." };
    if (code === "OVERRIDE_REASON_REQUIRED") return { error: "Provide an override reason of at least 8 characters." };
    throw error;
  }
  revalidatePath("/occupancy"); revalidatePath("/rooms"); revalidatePath("/students"); revalidatePath("/student-property"); revalidatePath("/assets"); revalidatePath("/dashboard"); redirect(`/occupancy/${occupancy.id}/clearance`);
}
