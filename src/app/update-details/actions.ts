"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeStudentDocument, normalizeStudentPhone } from "@/lib/student-identifiers";
import { clearStudentUpdateSession, createStudentUpdateSession, getPublicLookupFingerprint, getStudentUpdateSession } from "@/lib/student-update-session";

export type StudentLookupState = { error: string };
export type StudentDetailsSubmissionState = { error: string };

const phoneSchema = z.string().trim().regex(/^\+?[0-9][0-9\s-]{8,19}$/);
const lookupSchema = z.object({ fullName: z.string().trim().min(2).max(120), phone: phoneSchema });
const submissionSchema = z.object({
  email: z.union([z.literal(""), z.string().trim().email()]),
  admissionNumber: z.string().trim().max(50),
  nationalId: z.string().trim().max(30),
  guardianName: z.string().trim().min(2, "Enter the guardian’s full name.").max(120),
  guardianPhone: phoneSchema,
  guardianRelationship: z.string().trim().min(2, "Enter the student’s relationship to the guardian.").max(50),
  guardianEmail: z.union([z.literal(""), z.string().trim().email()]),
  consent: z.literal("on"),
});

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function isPrismaError(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export async function identifyStudentAction(_state: StudentLookupState, formData: FormData): Promise<StudentLookupState> {
  const parsed = lookupSchema.safeParse({ fullName: formData.get("fullName"), phone: formData.get("phone") });
  if (!parsed.success) return { error: "Enter your full name and registered phone number." };
  const organization = await db.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!organization) return { error: "Student detail updates are temporarily unavailable." };

  const fingerprintHash = await getPublicLookupFingerprint();
  const attemptedAfter = new Date(Date.now() - 15 * 60 * 1000);
  const recentAttempts = await db.publicStudentLookupAttempt.count({ where: { fingerprintHash, attemptedAt: { gte: attemptedAfter } } });
  if (recentAttempts >= 8) return { error: "Too many attempts. Please wait 15 minutes before trying again." };

  const phone = normalizeStudentPhone(parsed.data.phone);
  const candidates = await db.student.findMany({
    where: { organizationId: organization.id, phone, status: "ACTIVE" },
    select: { id: true, fullName: true },
    take: 3,
  });
  const student = candidates.find((candidate) => normalizeName(candidate.fullName) === normalizeName(parsed.data.fullName));
  await db.publicStudentLookupAttempt.create({ data: { organizationId: organization.id, fingerprintHash, matched: Boolean(student) } });
  if (!student) return { error: "We could not verify those details. Use your registered name and phone number or contact the hostel office." };

  await createStudentUpdateSession({ studentId: student.id, organizationId: organization.id, submittedName: parsed.data.fullName.trim(), submittedPhone: phone });
  redirect("/update-details/form");
}

export async function submitStudentDetailsAction(_state: StudentDetailsSubmissionState, formData: FormData): Promise<StudentDetailsSubmissionState> {
  const session = await getStudentUpdateSession();
  if (!session) return { error: "Your update session has expired. Return to the first page and verify your details again." };
  const parsed = submissionSchema.safeParse({
    email: formData.get("email") ?? "", admissionNumber: formData.get("admissionNumber") ?? "", nationalId: formData.get("nationalId") ?? "",
    guardianName: formData.get("guardianName"), guardianPhone: formData.get("guardianPhone"), guardianRelationship: formData.get("guardianRelationship"), guardianEmail: formData.get("guardianEmail") ?? "", consent: formData.get("consent"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Complete all required details." };

  const student = await db.student.findFirst({ where: { id: session.studentId, organizationId: session.organizationId, status: "ACTIVE" }, select: { id: true, email: true, admissionNumber: true, nationalId: true } });
  if (!student) return { error: "This student record is no longer available for updates." };
  if (!student.email && !parsed.data.email) return { error: "Enter the student email address." };
  if (!student.admissionNumber && !parsed.data.admissionNumber) return { error: "Enter the admission number." };
  if (!student.nationalId && !parsed.data.nationalId) return { error: "Enter the national ID or identification number." };

  const admissionNumber = !student.admissionNumber ? normalizeStudentDocument(parsed.data.admissionNumber) : null;
  const nationalId = !student.nationalId ? normalizeStudentDocument(parsed.data.nationalId) : null;
  const conflictingStudent = await db.student.findFirst({
    where: {
      organizationId: session.organizationId,
      NOT: { id: student.id },
      OR: [
        ...(admissionNumber ? [{ admissionNumber: { equals: admissionNumber, mode: "insensitive" as const } }] : []),
        ...(nationalId ? [{ nationalId: { equals: nationalId, mode: "insensitive" as const } }] : []),
      ],
    },
    select: { id: true },
  });
  if (conflictingStudent) return { error: "The admission number or national ID is already attached to another student. Contact the hostel office for assistance." };

  try {
    await db.$transaction(async (tx) => {
      const pending = await tx.studentDetailsUpdateRequest.findFirst({ where: { studentId: student.id, status: "PENDING" }, select: { id: true } });
      if (pending) throw new Error("PENDING_EXISTS");
      const request = await tx.studentDetailsUpdateRequest.create({ data: {
        organizationId: session.organizationId, studentId: student.id, submittedName: session.submittedName, submittedPhone: session.submittedPhone,
        email: !student.email ? parsed.data.email.toLowerCase() : null, admissionNumber, nationalId,
        guardianName: parsed.data.guardianName, guardianPhone: normalizeStudentPhone(parsed.data.guardianPhone), guardianRelationship: parsed.data.guardianRelationship,
        guardianEmail: parsed.data.guardianEmail ? parsed.data.guardianEmail.toLowerCase() : null, consentConfirmedAt: new Date(),
      } });
      await tx.auditLog.create({ data: { organizationId: session.organizationId, action: "STUDENT_DETAILS_UPDATE_SUBMITTED", entityType: "StudentDetailsUpdateRequest", entityId: request.id, metadata: { studentId: student.id, fields: [student.email ? null : "email", student.admissionNumber ? null : "admissionNumber", student.nationalId ? null : "nationalId", "guardian"].filter(Boolean) } } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if ((error instanceof Error && error.message === "PENDING_EXISTS") || isPrismaError(error, "P2002")) return { error: "An update for this student is already waiting for review." };
    throw error;
  }
  await clearStudentUpdateSession();
  revalidatePath("/students/update-requests");
  redirect("/update-details/submitted");
}
