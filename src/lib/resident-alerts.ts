import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "./auth/session";
import type { TenantSession } from "./auth/tenant-session";
import { residentStaff, residentTenant } from "./resident-access";
export type ResidentAlertSummary = { observedAt: string; overdueCount: number; pendingVisits: number; awaitingManagement: number | null; pendingRegistrations: number | null; unreadMessages: number | null; overdue: Array<{ id: string; visitorName: string; host: string; room: string; expectedDeparture: string; timeZone: string }> };
export async function residentAlerts(db: PrismaClient, session: SessionPayload | TenantSession | null, tenant: boolean, now = new Date()): Promise<ResidentAlertSummary | null> {
  if (!session) return null;
  const staff = tenant ? null : await residentStaff(db, session as SessionPayload);
  if (tenant ? !await residentTenant(db, session as TenantSession) : !staff) return null;
  const scope = { organizationId: session.organizationId, ...(tenant ? { studentId: (session as TenantSession).studentId } : {}) };
  const managers = !!staff && ["OWNER", "ADMIN", "MANAGER"].includes(staff.role);
  const overdueScope = { ...scope, status: "CHECKED_IN", expectedDeparture: { lt: now } };
  const [overdueCount, pendingVisits, visits, awaitingManagement, pendingRegistrations, unreadMessages] = await Promise.all([
    db.visitorRequest.count({ where: overdueScope }),
    db.visitorRequest.count({ where: { ...scope, status: "REQUESTED", expectedDeparture: { gt: now } } }),
    db.visitorRequest.findMany({ where: overdueScope, orderBy: [{ expectedDeparture: "asc" }, { id: "asc" }], take: 10, select: { id: true, visitorName: true, roomLabel: true, expectedDeparture: true, timeZone: true, student: { select: { fullName: true } } } }),
    managers ? db.tenantConversation.count({ where: { organizationId: session.organizationId, status: "OPEN" } }) : null,
    managers ? db.tenantRegistration.count({ where: { organizationId: session.organizationId, status: "PENDING", expiresAt: { gt: now } } }) : null,
    tenant ? db.tenantMessage.count({ where: { ...scope, readAt: null, publishAt: { lte: now } } }) : null,
  ]);
  return { observedAt: now.toISOString(), overdueCount, pendingVisits, awaitingManagement, pendingRegistrations, unreadMessages, overdue: visits.map(v => ({ id: v.id, visitorName: v.visitorName, host: tenant ? "You" : v.student.fullName, room: v.roomLabel, expectedDeparture: v.expectedDeparture.toISOString(), timeZone: v.timeZone })) };
}
