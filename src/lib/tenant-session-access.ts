import type { PrismaClient } from '@/generated/prisma/client';
import { localSessionCurrent } from '@/lib/account-security-policy';

export type TenantSession = { studentId: string; organizationId: string; name: string; sessionVersion?: number };

// Signature and host checks happen in the cookie reader. Always recheck current
// account access here so an old signed cookie cannot survive a portal revocation.
export async function currentTenantSession(database: Pick<PrismaClient, 'student'>, claims: unknown): Promise<TenantSession | null> {
  if (!claims || typeof claims !== 'object') return null;
  const session = claims as TenantSession;
  if ([session.studentId, session.organizationId].some(value => typeof value !== 'string' || !value || value.length > 128)) return null;
  if (session.sessionVersion !== undefined && (!Number.isSafeInteger(session.sessionVersion) || session.sessionVersion < 0)) return null;
  const student = await database.student.findFirst({
    where: { id: session.studentId, organizationId: session.organizationId, portalEnabled: true, portalPasswordHash: { not: null }, status: { not: 'ARCHIVED' }, organization: { status: 'ACTIVE' } },
    select: { id: true, organizationId: true, fullName: true, portalSessionVersion: true },
  });
  if (!student || !localSessionCurrent(session.sessionVersion, student.portalSessionVersion)) return null;
  return { studentId: student.id, organizationId: student.organizationId, name: student.fullName, sessionVersion: student.portalSessionVersion };
}
