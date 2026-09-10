"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { requireSession } from "@/lib/auth/session";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { getEffectiveRoomStatus } from "@/lib/rooms";

export type StudentImportState = { error: string; message: string; details: string[] };
type ImportRoom = Prisma.RoomGetPayload<{ include: { roomType: true } }>;
type ImportSemester = Prisma.SemesterGetPayload<Record<string, never>>;

async function requireImportAccess() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/students");
  return session;
}

const headerAliases: Record<string, string> = {
  fullname: "fullName", studentname: "fullName", name: "fullName", phone: "phone", phonenumber: "phone",
  university: "university", institution: "university", admissionnumber: "admissionNumber", admissionno: "admissionNumber", registrationnumber: "admissionNumber",
  nationalid: "nationalId", idnumber: "nationalId", admittedat: "admittedAt", admissiondate: "admittedAt", status: "status", notes: "notes",
  guardianname: "guardianName", parentname: "guardianName", guardianphone: "guardianPhone", parentphone: "guardianPhone",
  guardianrelationship: "guardianRelationship", relationship: "guardianRelationship", guardianemail: "guardianEmail",
  roomnumber: "roomNumber", room: "roomNumber", semestername: "semesterName", semester: "semesterName", checkinat: "checkInAt", checkindate: "checkInAt",
};
const normalizeHeader = (value: string) => headerAliases[value.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? "";
const phone = z.string().trim().regex(/^\+?[0-9][0-9\s-]{8,19}$/);
const rowSchema = z.object({
  fullName: z.string().trim().min(2).max(120), phone, university: z.string().trim().min(2).max(100).default("JKUAT"),
  admissionNumber: z.string().trim().max(50).default(""), nationalId: z.string().trim().max(30).default(""),
  admittedAt: z.string().trim().default(""), status: z.enum(["ACTIVE", "CHECKED_OUT", "SUSPENDED", "ARCHIVED"]).default("ACTIVE"), notes: z.string().trim().max(500).default(""),
  guardianName: z.string().trim().min(2).max(120), guardianPhone: phone, guardianRelationship: z.string().trim().max(50).default(""), guardianEmail: z.union([z.literal(""), z.string().trim().email()]).default(""),
  roomNumber: z.string().trim().max(20).default(""), semesterName: z.string().trim().max(100).default(""), checkInAt: z.string().trim().default(""),
});

function parseDate(value: string, fallback: Date) {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function importStudentsAction(_state: StudentImportState, formData: FormData): Promise<StudentImportState> {
  const session = await requireImportAccess();
  const file = formData.get("students");
  if (!(file instanceof File) || !file.size) return { error: "Select a student CSV file.", message: "", details: [] };
  if (file.size > 2_000_000) return { error: "The CSV must be smaller than 2 MB.", message: "", details: [] };
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "The CSV has no student rows.", message: "", details: [] };
  if (rows.length > 501) return { error: "Import a maximum of 500 students at a time.", message: "", details: [] };
  const headers = rows[0].map(normalizeHeader);
  const required = ["fullName", "phone", "guardianName", "guardianPhone"];
  if (required.some((name) => !headers.includes(name))) return { error: "CSV requires fullName, phone, guardianName and guardianPhone columns.", message: "", details: [] };

  let imported = 0; let allocated = 0; let skipped = 0; let failed = 0;
  const details: string[] = [];
  for (const [offset, values] of rows.slice(1).entries()) {
    const rowNumber = offset + 2;
    const raw = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]).filter(([header]) => header));
    const parsed = rowSchema.safeParse({ ...raw, university: raw.university || "JKUAT", status: String(raw.status || "ACTIVE").trim().toUpperCase().replaceAll(" ", "_") });
    if (!parsed.success) { failed += 1; details.push(`Row ${rowNumber}: ${parsed.error.issues[0]?.path.join(".") || "data"} is invalid.`); continue; }
    const item = parsed.data;
    const admittedAt = parseDate(item.admittedAt, new Date());
    const checkInAt = parseDate(item.checkInAt, admittedAt ?? new Date());
    if (!admittedAt || !checkInAt) { failed += 1; details.push(`Row ${rowNumber}: dates must use YYYY-MM-DD.`); continue; }
    if (item.roomNumber && !item.semesterName) { failed += 1; details.push(`Row ${rowNumber}: semesterName is required when roomNumber is supplied.`); continue; }
    if (item.roomNumber && item.status !== "ACTIVE") { failed += 1; details.push(`Row ${rowNumber}: only ACTIVE students can be allocated a room.`); continue; }
    const admissionNumber = item.admissionNumber ? item.admissionNumber.toUpperCase() : null;
    const duplicate = await db.student.findFirst({ where: { organizationId: session.organizationId, OR: [...(admissionNumber ? [{ admissionNumber }] : []), { phone: item.phone }] }, select: { fullName: true } });
    if (duplicate) { skipped += 1; details.push(`Row ${rowNumber}: skipped duplicate (${duplicate.fullName}).`); continue; }

    try {
      await db.$transaction(async (tx) => {
        let room: ImportRoom | null = null;
        let semester: ImportSemester | null = null;
        if (item.roomNumber) {
          room = await tx.room.findFirst({ where: { organizationId: session.organizationId, number: item.roomNumber }, include: { roomType: true } });
          semester = await tx.semester.findFirst({ where: { organizationId: session.organizationId, name: { equals: item.semesterName, mode: "insensitive" }, status: { in: ["ACTIVE", "UPCOMING"] } } });
          if (!room) throw new Error("ROOM_NOT_FOUND");
          if (!semester) throw new Error("SEMESTER_NOT_FOUND");
          if (room.status === "MAINTENANCE" || room.status === "INACTIVE") throw new Error("ROOM_CLOSED");
          const occupancyCount = await tx.occupancy.count({ where: { roomId: room.id, status: "ACTIVE" } });
          const capacity = room.capacityOverride ?? room.roomType.defaultCapacity;
          if (occupancyCount >= capacity) throw new Error("ROOM_FULL");
        }
        const student = await tx.student.create({ data: { organizationId: session.organizationId, fullName: item.fullName, phone: item.phone, university: item.university, admissionNumber, nationalId: item.nationalId || null, admittedAt, status: item.status, notes: item.notes || null, guardian: { create: { name: item.guardianName, phone: item.guardianPhone, relationship: item.guardianRelationship || null, email: item.guardianEmail || null } } } });
        if (room && semester) {
          const occupancy = await tx.occupancy.create({ data: { organizationId: session.organizationId, semesterId: semester.id, studentId: student.id, roomId: room.id, checkInAt, expectedCheckoutAt: semester.endDate, status: "ACTIVE", checkInCondition: "Imported with initial student register.", clearanceStatus: "PENDING" } });
          await tx.charge.create({ data: { organizationId: session.organizationId, semesterId: semester.id, studentId: student.id, occupancyId: occupancy.id, type: "SEMESTER_RENT", description: `${semester.name} rent · Room ${room.number}`, amount: room.roomType.semesterRate, dueDate: semester.startDate, status: "UNPAID" } });
          const activeCount = await tx.occupancy.count({ where: { roomId: room.id, status: "ACTIVE" } });
          await tx.room.update({ where: { id: room.id }, data: { status: getEffectiveRoomStatus(room.status, activeCount, room.capacityOverride ?? room.roomType.defaultCapacity) } });
        }
        await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "STUDENT_IMPORTED", entityType: "Student", entityId: student.id, metadata: { rowNumber, admissionNumber, roomNumber: item.roomNumber || null, semesterName: item.semesterName || null } } });
      }, { isolationLevel: "Serializable" });
      imported += 1; if (item.roomNumber) allocated += 1;
    } catch (error) {
      failed += 1;
      const reason = error instanceof Error ? error.message : "IMPORT_FAILED";
      const labels: Record<string, string> = { ROOM_NOT_FOUND: `room ${item.roomNumber} was not found`, SEMESTER_NOT_FOUND: `semester ${item.semesterName} was not found or is closed`, ROOM_CLOSED: `room ${item.roomNumber} is unavailable`, ROOM_FULL: `room ${item.roomNumber} is full` };
      details.push(`Row ${rowNumber}: ${labels[reason] ?? "could not be imported"}.`);
    }
  }
  revalidatePath("/students"); revalidatePath("/rooms"); revalidatePath("/payments"); revalidatePath("/dashboard");
  return { error: "", message: `Imported ${imported}; allocated ${allocated}; duplicates skipped ${skipped}; failed ${failed}.`, details: details.slice(0, 20) };
}
