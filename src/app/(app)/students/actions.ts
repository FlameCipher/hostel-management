"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { matchingStudentIdentifier, normalizeStudentIdentifiers } from "@/lib/student-identifiers";

export type StudentFormState = { error: string };

const phoneSchema = z.string().trim().regex(/^\+?[0-9][0-9\s-]{8,19}$/, "Enter a valid phone number.");
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional();
const optionalPhoneSchema = z.union([z.literal(""), phoneSchema]);

const studentSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the student’s full name.").max(120),
  phone: phoneSchema,
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid student email.")]),
  university: z.string().trim().min(2, "Enter the university name.").max(100),
  admissionNumber: optionalText(50),
  nationalId: optionalText(30),
  admittedAt: z.string().date("Select a valid admission date."),
  status: z.enum(["ACTIVE", "CHECKED_OUT", "SUSPENDED", "ARCHIVED"]),
  notes: optionalText(500),
  guardianName: z.union([z.literal(""), z.string().trim().min(2, "Enter the parent or guardian name.").max(120)]),
  guardianPhone: optionalPhoneSchema,
  guardianRelationship: optionalText(50),
  guardianEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid guardian email.")]),
}).superRefine((data, context) => {
  const hasGuardianDetails = Boolean(
    data.guardianName || data.guardianPhone || data.guardianRelationship || data.guardianEmail,
  );
  if (!hasGuardianDetails) return;
  if (!data.guardianName) context.addIssue({ code: "custom", path: ["guardianName"], message: "Enter the guardian name or leave the entire guardian section blank." });
  if (!data.guardianPhone) context.addIssue({ code: "custom", path: ["guardianPhone"], message: "Enter the guardian phone or leave the entire guardian section blank." });
});

const studentIntakeSchema = studentSchema.safeExtend({
  roomTypeId: z.string().min(1, "Select an accommodation type."),
  semesterId: z.string().min(1, "Select the active semester."),
});

async function requireStudentManager() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/students");
  return session;
}

function studentValues(formData: FormData) {
  return {
    fullName: formData.get("fullName"), phone: formData.get("phone"), email: formData.get("email"), university: formData.get("university"),
    admissionNumber: formData.get("admissionNumber"), nationalId: formData.get("nationalId"),
    admittedAt: formData.get("admittedAt"), status: formData.get("status"), notes: formData.get("notes"),
    guardianName: formData.get("guardianName"), guardianPhone: formData.get("guardianPhone"),
    guardianRelationship: formData.get("guardianRelationship"), guardianEmail: formData.get("guardianEmail"),
  };
}

function parseStudent(formData: FormData) {
  return studentSchema.safeParse(studentValues(formData));
}

function guardianData(data: {
  guardianName: string;
  guardianPhone: string;
  guardianRelationship?: string;
  guardianEmail: string;
}) {
  if (!data.guardianName && !data.guardianPhone && !data.guardianRelationship && !data.guardianEmail) return null;
  return {
    name: data.guardianName,
    phone: data.guardianPhone,
    relationship: data.guardianRelationship || null,
    email: data.guardianEmail || null,
  };
}

async function findDuplicateStudent(
  organizationId: string,
  identifiers: { phone: string; admissionNumber: string | null; nationalId: string | null },
  exceptStudentId?: string,
) {
  const candidates = await db.student.findMany({
    where: { organizationId, ...(exceptStudentId ? { NOT: { id: exceptStudentId } } : {}) },
    select: { id: true, fullName: true, phone: true, admissionNumber: true, nationalId: true },
  });
  for (const candidate of candidates) {
    const field = matchingStudentIdentifier(identifiers, candidate);
    if (field) return { ...candidate, field };
  }
  return null;
}

function duplicateStudentMessage(duplicate: { fullName: string; field: string }) {
  return `A student named ${duplicate.fullName} is already registered with this ${duplicate.field}.`;
}

function isPrismaError(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export async function createStudentAction(_state: StudentFormState, formData: FormData): Promise<StudentFormState> {
  const session = await requireStudentManager();
  const parsed = studentIntakeSchema.safeParse({
    ...studentValues(formData),
    roomTypeId: formData.get("roomTypeId"),
    semesterId: formData.get("semesterId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the student details." };
  const identifiers = normalizeStudentIdentifiers(parsed.data);
  const duplicate = await findDuplicateStudent(session.organizationId, identifiers);
  if (duplicate) return { error: duplicateStudentMessage(duplicate) };

  const [roomType, semester] = await Promise.all([
    db.roomType.findFirst({ where: { id: parsed.data.roomTypeId, organizationId: session.organizationId, active: true } }),
    db.semester.findFirst({ where: { id: parsed.data.semesterId, organizationId: session.organizationId, status: "ACTIVE" } }),
  ]);
  if (!roomType) return { error: "The selected accommodation type is unavailable." };
  if (!semester) return { error: "The selected semester is no longer active." };
  const guardian = guardianData(parsed.data);

  let chargeId = "";
  try {
    await db.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        organizationId: session.organizationId, fullName: parsed.data.fullName, phone: identifiers.phone, email: parsed.data.email || null,
        university: parsed.data.university, admissionNumber: identifiers.admissionNumber, nationalId: identifiers.nationalId,
        admittedAt: new Date(`${parsed.data.admittedAt}T12:00:00.000Z`), status: parsed.data.status,
        notes: parsed.data.notes || null,
        ...(guardian ? { guardian: { create: guardian } } : {}),
      },
    });
    const charge = await tx.charge.create({
      data: {
        organizationId: session.organizationId,
        studentId: student.id,
        semesterId: semester.id,
        roomTypeId: roomType.id,
        type: "SEMESTER_RENT",
        description: `${semester.name} rent · ${roomType.name} · room pending allocation`,
        amount: roomType.semesterRate,
        dueDate: semester.startDate,
        status: "UNPAID",
      },
    });
    chargeId = charge.id;
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "STUDENT_CREATED", entityType: "Student", entityId: student.id, metadata: { fullName: student.fullName, admissionNumber: identifiers.admissionNumber, roomTypeId: roomType.id, initialChargeId: charge.id } } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return { error: "A student with this phone number, admission number, or national ID already exists." };
    throw error;
  }
  revalidatePath("/students"); revalidatePath("/payments"); revalidatePath("/dashboard"); redirect(`/payments/new?chargeId=${chargeId}&intake=1`);
}

export async function updateStudentAction(studentId: string, _state: StudentFormState, formData: FormData): Promise<StudentFormState> {
  const session = await requireStudentManager();
  const parsed = parseStudent(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the student details." };
  const identifiers = normalizeStudentIdentifiers(parsed.data);
  const student = await db.student.findFirst({ where: { id: studentId, organizationId: session.organizationId }, select: { id: true } });
  if (!student) return { error: "This student could not be found." };
  const duplicate = await findDuplicateStudent(session.organizationId, identifiers, studentId);
  if (duplicate) return { error: duplicateStudentMessage(duplicate) };

  const guardian = guardianData(parsed.data);
  try {
    await db.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: studentId },
      data: {
        fullName: parsed.data.fullName, phone: identifiers.phone, email: parsed.data.email || null, university: parsed.data.university,
        admissionNumber: identifiers.admissionNumber, nationalId: identifiers.nationalId,
        admittedAt: new Date(`${parsed.data.admittedAt}T12:00:00.000Z`), status: parsed.data.status, notes: parsed.data.notes || null,
      },
    });
    if (guardian) {
      await tx.guardian.upsert({ where: { studentId }, create: { studentId, ...guardian }, update: guardian });
    } else {
      await tx.guardian.deleteMany({ where: { studentId } });
    }
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "STUDENT_UPDATED", entityType: "Student", entityId: studentId, metadata: { fullName: parsed.data.fullName, admissionNumber: identifiers.admissionNumber, status: parsed.data.status } } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return { error: "A student with this phone number, admission number, or national ID already exists." };
    throw error;
  }
  revalidatePath("/students"); revalidatePath("/dashboard"); redirect("/students");
}

export type DeleteStudentState = { error: string };

export async function deleteStudentAction(studentId: string, _state: DeleteStudentState, _formData: FormData): Promise<DeleteStudentState> {
  void _state;
  void _formData;
  const session = await requireStudentManager();
  if (!["OWNER", "ADMIN"].includes(session.role)) redirect("/students");

  const student = await db.student.findFirst({
    where: { id: studentId, organizationId: session.organizationId },
    include: {
      occupancies: { select: { id: true } },
      breakReservations: { select: { id: true } },
      payments: { select: { id: true } },
      notifications: { select: { id: true } },
      charges: {
        select: {
          id: true,
          occupancyId: true,
          breakReservationId: true,
          payments: { select: { id: true }, take: 1 },
        },
      },
    },
  });
  if (!student) return { error: "This student could not be found." };

  const hasHistory = student.occupancies.length > 0
    || student.breakReservations.length > 0
    || student.payments.length > 0
    || student.notifications.length > 0
    || student.charges.some((charge) => charge.occupancyId || charge.breakReservationId || charge.payments.length);
  if (hasHistory) return { error: "This student has accommodation, payment, reminder, or financial history and cannot be deleted. Archive the record instead." };

  await db.$transaction(async (tx) => {
    await tx.charge.deleteMany({ where: { studentId: student.id, organizationId: session.organizationId } });
    await tx.student.delete({ where: { id: student.id } });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "STUDENT_DELETED",
        entityType: "Student",
        entityId: student.id,
        metadata: { fullName: student.fullName, phone: student.phone, admissionNumber: student.admissionNumber, nationalId: student.nationalId },
      },
    });
  }, { isolationLevel: "Serializable" });

  revalidatePath("/students"); revalidatePath("/payments"); revalidatePath("/dashboard"); redirect("/students");
}
