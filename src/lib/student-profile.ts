import type { PrismaClient } from "@/generated/prisma/client";
import { currentTenantSession, type TenantSession } from "./tenant-session-access";

export async function getTenantProfile(database: Pick<PrismaClient, "student">, session: TenantSession | null) {
  const current = session ? await currentTenantSession(database, session) : null;
  if (!current) return null;
  return database.student.findFirst({
    where: { id: current.studentId, organizationId: current.organizationId, status: "ACTIVE", portalEnabled: true, organization: { status: "ACTIVE" } },
    select: {
      id: true, organizationId: true, fullName: true, phone: true, email: true,
      admissionNumber: true, nationalId: true, university: true,
      organization: { select: { name: true } },
      guardian: { select: { name: true, relationship: true, phone: true, email: true } },
      occupancies: { where: { status: { in: ["ACTIVE", "RESERVED"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { room: { select: { number: true } } } },
      detailsUpdateRequests: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, consentConfirmedAt: true, reviewNotes: true } },
    },
  });
}
