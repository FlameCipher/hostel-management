import type { Prisma } from "@/generated/prisma/client";
import type { SessionPayload } from "./auth/session";
import type { TenantSession } from "./auth/tenant-session";
import { localSessionCurrent } from "./account-security-policy";
export async function residentStaff(db: Pick<Prisma.TransactionClient, "user">, session: SessionPayload | null, managersOnly = false) {
  if (!session) return null;
  const user = await db.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, active: true, organization: { status: "ACTIVE" }, ...(managersOnly ? { role: { in: ["OWNER", "ADMIN", "MANAGER"] } } : {}) }, select: { id: true, role: true, sessionVersion: true } });
  return user && localSessionCurrent(session.sessionVersion, user.sessionVersion) ? user : null;
}
export async function residentTenant(db: Pick<Prisma.TransactionClient, "student">, session: TenantSession | null) {
  if (!session) return null;
  const student = await db.student.findFirst({ where: { id: session.studentId, organizationId: session.organizationId, status: "ACTIVE", portalEnabled: true, portalPasswordHash: { not: null }, organization: { status: "ACTIVE" }, occupancies: { some: { organizationId: session.organizationId, status: "ACTIVE", room: { organizationId: session.organizationId }, semester: { organizationId: session.organizationId } } } }, select: { id: true, portalSessionVersion: true } });
  return student && localSessionCurrent(session.sessionVersion, student.portalSessionVersion) ? student : null;
}
