"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { normalizeStudentDocument } from "@/lib/student-identifiers";

export type UpdateReviewState = { error: string; success: string };

async function requireReviewer() {
  const session = await requireSession();
  if (!["OWNER", "ADMIN"].includes(session.role)) redirect("/students");
  return session;
}

function isPrismaError(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export async function approveStudentUpdateAction(requestId: string, _state: UpdateReviewState): Promise<UpdateReviewState> {
  void _state;
  const session = await requireReviewer();
  const request = await db.studentDetailsUpdateRequest.findFirst({
    where: { id: requestId, organizationId: session.organizationId, status: "PENDING" },
    include: { student: { include: { guardian: true } } },
  });
  if (!request) return { error: "This request has already been reviewed or is unavailable.", success: "" };

  const admissionNumber = normalizeStudentDocument(request.admissionNumber);
  const nationalId = normalizeStudentDocument(request.nationalId);
  if (admissionNumber || nationalId) {
    const duplicate = await db.student.findFirst({
      where: { organizationId: session.organizationId, NOT: { id: request.studentId }, OR: [
        ...(admissionNumber ? [{ admissionNumber: { equals: admissionNumber, mode: "insensitive" as const } }] : []),
        ...(nationalId ? [{ nationalId: { equals: nationalId, mode: "insensitive" as const } }] : []),
      ] },
      select: { fullName: true },
    });
    if (duplicate) return { error: `The submitted admission number or national ID belongs to ${duplicate.fullName}. Reject this request and investigate the duplicate.`, success: "" };
  }

  try {
    await db.$transaction(async (tx) => {
      const current = await tx.studentDetailsUpdateRequest.findFirst({ where: { id: request.id, organizationId: session.organizationId, status: "PENDING" }, include: { student: true } });
      if (!current) throw new Error("ALREADY_REVIEWED");
      await tx.student.update({ where: { id: current.studentId }, data: {
        email: current.student.email || current.email,
        admissionNumber: current.student.admissionNumber || normalizeStudentDocument(current.admissionNumber),
        nationalId: current.student.nationalId || normalizeStudentDocument(current.nationalId),
      } });
      await tx.guardian.upsert({
        where: { studentId: current.studentId },
        create: { studentId: current.studentId, name: current.guardianName, phone: current.guardianPhone, relationship: current.guardianRelationship, email: current.guardianEmail },
        update: { name: current.guardianName, phone: current.guardianPhone, relationship: current.guardianRelationship, email: current.guardianEmail },
      });
      await tx.studentDetailsUpdateRequest.update({ where: { id: current.id }, data: { status: "APPROVED", reviewedById: session.userId, reviewedAt: new Date(), reviewNotes: null } });
      await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "STUDENT_DETAILS_UPDATE_APPROVED", entityType: "StudentDetailsUpdateRequest", entityId: current.id, metadata: { studentId: current.studentId } } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_REVIEWED") return { error: "This request has already been reviewed.", success: "" };
    if (isPrismaError(error, "P2002")) return { error: "The submitted admission number or national ID now conflicts with another student.", success: "" };
    throw error;
  }
  revalidatePath("/students"); revalidatePath("/students/update-requests");
  return { error: "", success: "Student details approved and saved." };
}

const rejectSchema = z.object({ reviewNotes: z.string().trim().min(3, "Enter a brief reason for rejection.").max(300) });

export async function rejectStudentUpdateAction(requestId: string, _state: UpdateReviewState, formData: FormData): Promise<UpdateReviewState> {
  const session = await requireReviewer();
  const parsed = rejectSchema.safeParse({ reviewNotes: formData.get("reviewNotes") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a rejection reason.", success: "" };
  const result = await db.studentDetailsUpdateRequest.updateMany({ where: { id: requestId, organizationId: session.organizationId, status: "PENDING" }, data: { status: "REJECTED", reviewedById: session.userId, reviewedAt: new Date(), reviewNotes: parsed.data.reviewNotes } });
  if (!result.count) return { error: "This request has already been reviewed or is unavailable.", success: "" };
  await db.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "STUDENT_DETAILS_UPDATE_REJECTED", entityType: "StudentDetailsUpdateRequest", entityId: requestId, metadata: { reason: parsed.data.reviewNotes } } });
  revalidatePath("/students/update-requests");
  return { error: "", success: "Update request rejected." };
}
