import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { TenantSession } from "@/lib/auth/tenant-session";
import type { SessionPayload } from "@/lib/auth/session";
import { TERMS_CONTACT, TERMS_DECLARATION, TERMS_ORGANIZATION_ID, TERMS_RULES, TERMS_VERSION, normalizedName, signatureSchema, snapshotSchema, termsHash } from "./policy";

type Reader = Pick<Prisma.TransactionClient, "student" | "occupancy">;
export async function currentTermsContext(database: Reader, session: TenantSession | null) {
  if (!session || session.organizationId !== TERMS_ORGANIZATION_ID) return null;
  const student = await database.student.findFirst({ where: { id: session.studentId, organizationId: session.organizationId, portalEnabled: true, status: { not: "ARCHIVED" } }, select: { id: true, fullName: true, admissionNumber: true, university: true } });
  if (!student) return null;
  const occupancy = await database.occupancy.findFirst({
    where: { studentId: student.id, organizationId: session.organizationId, status: { in: ["RESERVED", "ACTIVE"] }, room: { organizationId: session.organizationId }, semester: { organizationId: session.organizationId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { room: true, semester: true, charges: { where: { organizationId: session.organizationId, studentId: student.id, type: "SEMESTER_RENT" }, orderBy: { id: "asc" }, take: 100 } },
  });
  if (!occupancy) return { student, occupancy: null, snapshot: null };
  const snapshot = snapshotSchema.parse({ version: TERMS_VERSION, hostel: TERMS_CONTACT,
    student: { name: student.fullName, admissionNumber: student.admissionNumber ?? "Not recorded", institution: student.university },
    room: occupancy.room.number, semester: occupancy.semester.name, semesterStart: occupancy.semester.startDate.toISOString(), semesterEnd: occupancy.semester.endDate.toISOString(),
    rentCharges: occupancy.charges.map(c => ({ amount: c.amount.toFixed(2), dueDate: c.dueDate.toISOString() })), rules: TERMS_RULES, declaration: TERMS_DECLARATION,
  });
  return { student, occupancy, snapshot };
}

export async function signStudentTerms(database: Pick<PrismaClient, "$transaction">, session: TenantSession | null, input: unknown) {
  if (!session || session.organizationId !== TERMS_ORGANIZATION_ID) return { error: "Sign in to your student account to sign the terms." };
  const parsed = signatureSchema.safeParse(input);
  if (!parsed.success) return { error: "Read the current terms, type your full name and select the agreement checkbox." };
  return database.$transaction(async tx => {
    // The same student lock serializes duplicate submissions and portal eligibility changes.
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${session.studentId} AND "organizationId" = ${session.organizationId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Occupancy" WHERE id = ${parsed.data.occupancyId} AND "studentId" = ${session.studentId} AND "organizationId" = ${session.organizationId} FOR UPDATE`;
    const context = await currentTermsContext(tx, session);
    if (!context?.occupancy || !context.snapshot || context.occupancy.id !== parsed.data.occupancyId) return { error: "Your room allocation has changed or is unavailable. Reload the terms page." };
    if (parsed.data.documentHash !== termsHash(context.snapshot, "", new Date(0), "preview")) return { error: "The terms or allocation details have changed. Reload and read the current terms before signing." };
    if (normalizedName(parsed.data.signatureName) !== normalizedName(context.student.fullName)) return { error: "Type your full name exactly as shown in your student account." };
    const where = { organizationId: session.organizationId, studentId: session.studentId, occupancyId: context.occupancy.id, version: TERMS_VERSION };
    const existing = await tx.studentTermsAcceptance.findFirst({ where });
    if (existing) return { id: existing.id };
    const acceptedAt = new Date();
    const reference = "MMH-TERMS-" + randomUUID().toUpperCase();
    const signatureName = parsed.data.signatureName;
    const record = await tx.studentTermsAcceptance.create({ data: { ...where, reference, acceptedAt, signatureName, snapshot: context.snapshot, integrityHash: termsHash(context.snapshot, signatureName, acceptedAt, reference) } });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, action: "STUDENT_TERMS_SIGNED", entityType: "StudentTermsAcceptance", entityId: record.id, metadata: { studentId: session.studentId, occupancyId: context.occupancy.id, version: TERMS_VERSION } } });
    return { id: record.id };
  }, { timeout: 10000 });
}

export async function tenantTermsRecord(database: Pick<PrismaClient, "student" | "studentTermsAcceptance">, session: TenantSession | null, id: string) {
  if (!session || session.organizationId !== TERMS_ORGANIZATION_ID || id.length > 128) return null;
  const student = await database.student.findFirst({ where: { id: session.studentId, organizationId: session.organizationId, portalEnabled: true, status: { not: "ARCHIVED" } }, select: { id: true } });
  if (!student) return null;
  return database.studentTermsAcceptance.findFirst({ where: { id, studentId: student.id, organizationId: session.organizationId } });
}
export async function termsManager(database: Pick<PrismaClient, "user">, session: SessionPayload | null) {
  if (!session || session.organizationId !== TERMS_ORGANIZATION_ID) return null;
  return database.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, active: true, role: { in: ["OWNER", "ADMIN", "MANAGER"] } }, select: { id: true } });
}
export async function managerTermsRecord(database: Pick<PrismaClient, "user" | "studentTermsAcceptance">, session: SessionPayload | null, id: string) {
  if (!await termsManager(database, session) || !session || id.length > 128) return null;
  return database.studentTermsAcceptance.findFirst({ where: { id, organizationId: session.organizationId } });
}
