import type { Prisma } from "@/generated/prisma/client";
import type { SessionPayload } from "./auth/session";
import { localSessionCurrent } from "./account-security-policy";
import { residentStaff } from "./resident-access";

export function canOnboardAccounts(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

/** Owners and the administrators they appoint control admission and account access. */
export async function onboardingAdmin(database: Pick<Prisma.TransactionClient, "user">, session: SessionPayload | null) {
  if (!session) return null;
  const actor = await database.user.findFirst({
    where: { id: session.userId, organizationId: session.organizationId, active: true,
      organization: { status: "ACTIVE" }, role: { in: ["OWNER", "ADMIN"] } },
    select: { id: true, role: true, sessionVersion: true },
  });
  return actor && canOnboardAccounts(actor.role) && localSessionCurrent(session.sessionVersion, actor.sessionVersion) ? actor : null;
}

/** Hold authorization stable until the enrollment transaction finishes. */
export async function requireOnboardingAdmin(database: Prisma.TransactionClient, session: SessionPayload) {
  await database.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR SHARE`;
  await database.$queryRaw`SELECT id FROM "User" WHERE id=${session.userId} AND "organizationId"=${session.organizationId} FOR SHARE`;
  if (!await onboardingAdmin(database, session)) throw new Error("Only an active hostel owner or authorised admin may onboard accounts.");
}

type StudentIdentity = { fullName: string; phone: string; email: string | null; status: string; admissionNumber: string | null; nationalId: string | null };

/** A manager must not repurpose an enrolled account by changing its identity or login contacts. */
export async function studentIdentityUpdateError(database: Prisma.TransactionClient, session: SessionPayload, studentId: string, next: StudentIdentity): Promise<string | null> {
  await database.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR SHARE`;
  await database.$queryRaw`SELECT id FROM "User" WHERE id=${session.userId} AND "organizationId"=${session.organizationId} FOR SHARE`;
  const actor = await residentStaff(database, session, true);
  if (!actor || !["OWNER", "ADMIN", "MANAGER"].includes(actor.role)) return "Your management access changed. Sign in again.";
  await database.$queryRaw`SELECT id FROM "Student" WHERE id=${studentId} AND "organizationId"=${session.organizationId} FOR UPDATE`;
  const current = await database.student.findFirst({ where: { id: studentId, organizationId: session.organizationId },
    select: { fullName: true, phone: true, email: true, status: true, admissionNumber: true, nationalId: true } });
  if (!current) return "This student could not be found.";
  if (canOnboardAccounts(actor.role)) return null;
  const normalized = (record: StudentIdentity) => [record.fullName.trim().replace(/\s+/g, " ").toLowerCase(),
    record.phone.replace(/[^0-9]/g, ""), record.email?.trim().toLowerCase() || "", record.status,
    record.admissionNumber?.trim() || "", record.nationalId?.trim() || ""];
  const nextIdentity = normalized(next);
  return normalized(current).some((value, index) => value !== nextIdentity[index])
    ? "Only the hostel owner or an authorised admin may change a student's identity, sign-in contacts or account status."
    : null;
}
