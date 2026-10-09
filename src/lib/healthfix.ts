import { createHash, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
type CheckStatus = "PASSING" | "WARNING" | "FAILING" | "UNKNOWN";
type Check = { code: string; name: string; status: CheckStatus; checkType: string };
type Module = { code: string; name: string; status: "HEALTHY" | "DEGRADED" | "UNKNOWN"; checks: Check[] };
export const interruptedAfterMs = 15 * 60000;
export const backlogAfterMs = 26 * 3600000;
export function healthfixAuthorized(expected: string | undefined, supplied: string | null) {
  if (!expected || !supplied) return false;
  return timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(supplied).digest());
}
export async function healthfixManager(db: Pick<PrismaClient, "user">, session: SessionPayload | null) {
  if (!session) return null;
  return db.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, active: true, role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } });
}
function module(code: string, name: string, checks: Check[]): Module {
  return { code, name, checks, status: checks.some(c => ["FAILING", "WARNING"].includes(c.status)) ? "DEGRADED" : checks.some(c => c.status === "UNKNOWN") ? "UNKNOWN" : "HEALTHY" };
}
function configuration(code: string, name: string, configured: boolean): Check {
  return { code, name, status: configured ? "PASSING" : "FAILING", checkType: "CONFIGURATION" };
}
function unknown(code: string, name: string): Check { return { code, name, status: "UNKNOWN", checkType: "FUNCTIONAL" }; }
export function maintenanceRunStatus(createdAt: Date, run: { createdAt: Date; metadata: unknown } | undefined, now: Date): CheckStatus {
  // 08:00 EAT is 05:00 UTC; allow two hours for the daily batch to finish.
  const expected = new Date(now);
  expected.setUTCHours(5, 0, 0, 0);
  if (now.getTime() < expected.getTime() + 2 * 3600000) expected.setUTCDate(expected.getUTCDate() - 1);
  if (!run) return createdAt > expected ? "PASSING" : "WARNING";
  const meta = run.metadata && typeof run.metadata === "object" && !Array.isArray(run.metadata) ? run.metadata as Record<string, unknown> : {};
  if (meta.status === "FAILED") return "FAILING";
  if (run.createdAt < expected && createdAt <= expected) return "WARNING";
  if (meta.status === "RUNNING") return now.getTime() - run.createdAt.getTime() > interruptedAfterMs ? "WARNING" : "PASSING";
  return meta.status === "COMPLETED" ? "PASSING" : "UNKNOWN";
}
export async function maintenanceScheduleCheck(db: PrismaClient, organizationId: string | undefined, now: Date): Promise<Check> {
  let status: CheckStatus = "PASSING";
  try {
    const organizations = await db.organization.findMany({ where: { status: "ACTIVE", ...(organizationId ? { id: organizationId } : {}) }, select: { id: true, createdAt: true } });
    const runs = await db.auditLog.findMany({ where: { organizationId: { in: organizations.map(o => o.id) }, action: "HEALTHFIX_MAINTENANCE_RUN" }, distinct: ["organizationId"], orderBy: { createdAt: "desc" }, select: { organizationId: true, createdAt: true, metadata: true } });
    const byOrganization = new Map(runs.map(r => [r.organizationId, r]));
    const statuses = organizations.map(o => maintenanceRunStatus(o.createdAt, byOrganization.get(o.id), now));
    status = statuses.includes("FAILING") ? "FAILING" : statuses.includes("WARNING") ? "WARNING" : statuses.includes("UNKNOWN") ? "UNKNOWN" : "PASSING";
  } catch { status = "UNKNOWN"; }
  return { code: "daily-maintenance", name: "Daily repair receipts: missing, failed or interrupted runs need review (08:00 EAT; two-hour grace)", status, checkType: "DATABASE" };
}
// Scoped metadata reads only: no login, external sends, financial writes or customer identities.
export async function collectHealthfix(db: PrismaClient, organizationId?: string, now = new Date(), env: Record<string, string | undefined> = process.env) {
  const scope = organizationId ? { organizationId } : {};
  const modules: Module[] = [module("application", "Application", [{ code: "http", name: "HealthFix endpoint execution", status: "PASSING", checkType: "HTTP" }])];
  async function read(code: string, name: string, operation: () => Promise<unknown>, extra: Check[] = []) {
    let status: CheckStatus = "PASSING";
    try { await operation(); } catch { status = "FAILING"; }
    modules.push(module(code, name, [{ code: "read", name: "Read-only database access", status, checkType: "DATABASE" }, ...extra]));
  }
  await read("database", "Database", () => db.$queryRaw`SELECT 1`);
  modules.push(module("provisioning", "Platform provisioning", [configuration("configuration", "Provisioning secret configured", Boolean(env.PLATFORM_PROVISIONING_SECRET)), unknown("functional", "Provisioning flow not probed")]));
  await read("tenant-login", "Student login", () => db.student.count({ where: scope }), [configuration("session", "Session signing secret configured", (env.SESSION_SECRET?.length ?? 0) >= 16), unknown("login", "Student sign-in flow not probed")]);
  await read("bookings", "Rooms and allocations", () => Promise.all([db.occupancy.count({ where: scope }),db.bookingRequest.count({where:scope})]), [unknown("booking", "Booking completion not probed")]);
  await read("payments", "Rent and payments", () => Promise.all([db.charge.count({ where: scope }), db.payment.count({ where: scope })]), [unknown("reconciliation", "Financial reconciliation not performed")]);
  await read("website", "Property website and pictures", () => Promise.all([db.property.count({ where: scope }), db.propertyPhoto.count({ where: scope })]), [configuration("storage", "Public picture storage configured", Boolean(env.BLOB_READ_WRITE_TOKEN)), unknown("pictures", "Live photo upload and image delivery not independently probed")]);
  await read("terms", "Hostel terms", () => db.studentTermsAcceptance.count({ where: scope }), [unknown("pdf", "PDF generation and download not probed")]);
  await read("communications", "Tenant communications", () => Promise.all([db.tenantMessage.count({ where: scope }), db.tenantConversation.count({ where: scope })]), [unknown("workflow", "Message and reply flows not probed")]);
  await read("visitors", "Visitor requests and gate records", () => db.visitorRequest.count({ where: scope }), [unknown("verification", "Physical arrivals and departures require staff verification")]);
  await read("tenant-registration", "Tenant self-registration", () => db.tenantRegistration.count({ where: scope }), [unknown("identity", "Tenant identity is verified by management")]);
  await read("invitations", "Account invitations", () => db.tenantPortalInvitation.count({ where: scope }), [unknown("activation", "Account activation not probed")]);
  modules.push(module("email", "Email delivery", [configuration("sender", "Email key and sender configured", Boolean(env.RESEND_API_KEY && env.RECEIPT_EMAIL_FROM)), unknown("delivery", "Mailbox delivery not confirmed")]));
  modules.push(module("scheduler", "Scheduled processing", [configuration("secret", "Cron authentication configured", Boolean(env.CRON_SECRET)), await maintenanceScheduleCheck(db, organizationId, now)]));
  modules.push(module("whatsapp", "WhatsApp delivery", [unknown("automatic", "Automatic Business sender not connected")]));
  modules.push(module("assistant", "System assistant", [unknown("ai", "Documented guide available; generative AI provider not connected")]));
  modules.push(module("mobile-notifications", "Background mobile notifications", [unknown("push", "Live in-app alerts available; closed-app push delivery not connected")]));
  modules.push(module("recovery", "Backup and recovery", [unknown("restore", "Production backup restoration requires an isolated provider restore drill")]));
  const old = new Date(now.getTime() - interruptedAfterMs), overdue = new Date(now.getTime() - backlogAfterMs);
  async function warning(code: string, name: string, query: () => Promise<number>): Promise<Check> {
    let status: CheckStatus;
    try { status = await query() ? "WARNING" : "PASSING"; } catch { status = "FAILING"; }
    return { code, name, status, checkType: "DATABASE" };
  }
  const integrityScope = organizationId ?? null;
  modules.push(module("record-integrity", "Landlord record integrity", await Promise.all([
    warning("rooms", "Room property and room type belong to the same landlord", async () => {
      const rows = await db.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM "Room" r JOIN "Property" p ON p.id=r."propertyId" JOIN "RoomType" t ON t.id=r."roomTypeId" WHERE (${integrityScope}::text IS NULL OR r."organizationId"=${integrityScope}) AND (p."organizationId"<>r."organizationId" OR t."organizationId"<>r."organizationId")`;
      return rows[0].count;
    }),
    warning("allocations", "Allocation student, room and semester belong to the same landlord", async () => {
      const rows = await db.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM "Occupancy" o JOIN "Student" s ON s.id=o."studentId" JOIN "Room" r ON r.id=o."roomId" JOIN "Semester" t ON t.id=o."semesterId" WHERE (${integrityScope}::text IS NULL OR o."organizationId"=${integrityScope}) AND (s."organizationId"<>o."organizationId" OR r."organizationId"<>o."organizationId" OR t."organizationId"<>o."organizationId")`;
      return rows[0].count;
    }),
    warning("payments", "Payment and charge refer to the same student and landlord", async () => {
      const rows = await db.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM "Payment" p JOIN "SemesterCharge" c ON c.id=p."chargeId" JOIN "Student" s ON s.id=p."studentId" WHERE (${integrityScope}::text IS NULL OR p."organizationId"=${integrityScope}) AND (c."organizationId"<>p."organizationId" OR s."organizationId"<>p."organizationId" OR c."studentId"<>p."studentId")`;
      return rows[0].count;
    }),
  ])));
  modules.push(module("photo-guidelines", "Property photograph checks", await Promise.all([
    warning("classification", "Published pictures have an owner-confirmed building, compound or room category", () => db.propertyPhoto.count({ where: { ...scope, deletedAt: null, visible: true, OR: [{ category: null }, { confirmedAt: null }, { category: { notIn: ["EXTERIOR", "COMPOUND", "ROOM"] } }] } })),
    warning("review", "Older photographs awaiting owner classification", () => db.propertyPhoto.count({ where: { ...scope, deletedAt: null, url: { not: null }, category: null } })),
    warning("cover", "Website covers show building exteriors", () => db.propertyPhoto.count({ where: { ...scope, deletedAt: null, isCover: true, OR: [{ category: null }, { category: { not: "EXTERIOR" } }] } })),
    warning("group-limits", "No gallery group exceeds four photographs", async () => {
      const rows = await db.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM (SELECT "propertyId", "category", "roomTypeId" FROM "PropertyPhoto" WHERE "deletedAt" IS NULL AND "category" IS NOT NULL AND (${integrityScope}::text IS NULL OR "organizationId"=${integrityScope}) GROUP BY "propertyId", "category", "roomTypeId" HAVING COUNT(*)>4) groups`;
      return rows[0].count;
    }),
  ])));
  modules.push(module("delivery-queues", "Delivery queues", await Promise.all([
    warning("interrupted-invitations", "Interrupted invitation sends need review", () => db.tenantPortalInvitation.count({ where: { ...scope, usedAt: null, status: "SENDING", OR: [{ attemptedAt: null }, { attemptedAt: { lte: old } }] } })),
    warning("interrupted-email", "Interrupted notice sends need review", () => db.tenantMessage.count({ where: { ...scope, emailStatus: "SENDING", OR: [{ emailAttemptAt: null }, { emailAttemptAt: { lte: old } }] } })),
    warning("invitation-attention", "Invitations needing management attention", () => db.tenantPortalInvitation.count({ where: { ...scope, usedAt: null, status: { in: ["FAILED", "REVIEW", "MISSING_EMAIL"] } } })),
    warning("email-attention", "Notice emails needing management attention", () => db.tenantMessage.count({ where: { ...scope, emailStatus: { in: ["FAILED", "REVIEW", "MISSING_EMAIL"] } } })),
    warning("email-backlog", "Notice emails queued over 26 hours", () => db.tenantMessage.count({ where: { ...scope, emailStatus: { in: ["QUEUED", "RETRY"] }, publishAt: { lte: overdue } } })),
    warning("invitation-backlog", "Invitations queued over 26 hours", () => db.tenantPortalInvitation.count({ where: { ...scope, usedAt: null, status: { in: ["QUEUED", "RETRY"] }, createdAt: { lte: overdue } } })),
    warning("photo-uploads", "Website photo uploads without completion after expiry", () => db.propertyPhoto.count({ where: { ...scope, url: null, deletedAt: null, expiresAt: { lte: now } } })),
    warning("receipt-failures", "Recorded receipt delivery failures", () => db.payment.count({ where: { ...scope, reversedAt: null, receiptDeliveryStatus: "FAILED" } })),
  ])));
  return { productCode: "STUDENTSHOSTELS", service: "studentshostels", environment: env.VERCEL_ENV ?? env.NODE_ENV ?? "unknown", observedAt: now.toISOString(), status: modules.some(m => m.status === "DEGRADED") ? "DEGRADED" : modules.some(m => m.status === "UNKNOWN") ? "UNKNOWN" : "HEALTHY", modules };
}
// Only active owner/admin actions or the authenticated daily worker call this service.
export async function repairHealthfix(db: PrismaClient, organizationId: string, session: SessionPayload | null, now = new Date()) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"hostel-healthfix:" + organizationId}))`;
    if (session) {
      if (session.organizationId !== organizationId) throw Error("HEALTHFIX_DENIED");
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${session.userId} AND "organizationId"=${organizationId} FOR UPDATE`;
      if (!await healthfixManager(tx, session)) throw Error("HEALTHFIX_DENIED");
    }
    if (!await tx.organization.findFirst({ where: { id: organizationId, status: "ACTIVE" }, select: { id: true } })) throw Error("HEALTHFIX_DENIED");
    const old = new Date(now.getTime() - interruptedAfterMs);
    const invitations = await tx.tenantPortalInvitation.updateMany({ where: { organizationId, usedAt: null, status: "SENDING", OR: [{ attemptedAt: null }, { attemptedAt: { lte: old } }] }, data: { status: "REVIEW", error: "HealthFix detected an interrupted send. Reconcile provider status before sending again." } });
    const emails = await tx.tenantMessage.updateMany({ where: { organizationId, emailStatus: "SENDING", OR: [{ emailAttemptAt: null }, { emailAttemptAt: { lte: old } }] }, data: { emailStatus: "REVIEW", emailError: "HealthFix detected an interrupted send. Reconcile provider status before sending again." } });
    const expired = await tx.tenantPortalInvitation.updateMany({ where: { organizationId, usedAt: null, tokenHash: { not: null }, expiresAt: { lte: now }, status: { not: "ACTIVATED" } }, data: { status: "EXPIRED", tokenHash: null, error: "Invitation expired. Management can issue a new link." } });
    const registrations = await tx.tenantRegistration.updateMany({ where: { organizationId, status: "PENDING", expiresAt: { lte: now } }, data: { status: "EXPIRED", passwordHash: null } });
    const result = { expiredRegistrations: registrations.count, interruptedInvitations: invitations.count, interruptedEmails: emails.count, expiredInvitations: expired.count };
    if (Object.values(result).some(Boolean)) await tx.auditLog.create({ data: { organizationId, actorUserId: session?.userId, action: "HEALTHFIX_SAFE_REPAIR", entityType: "Organization", entityId: organizationId, metadata: { ...result, source: session ? "MANAGEMENT" : "DAILY_CRON", version: 1 } } });
    return result;
  }, { timeout: 15000 });
}
export async function runHealthfixMaintenance(db: PrismaClient, now = new Date()) {
  const organizations = await db.organization.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  let changed = 0, failed = 0;
  for (const organization of organizations) {
    let runId: string | undefined;
    const metadata = { source: "DAILY_CRON", version: 1, startedAt: now.toISOString() };
    try {
      const run = await db.auditLog.create({ data: { organizationId: organization.id, action: "HEALTHFIX_MAINTENANCE_RUN", entityType: "Organization", entityId: organization.id, metadata: { ...metadata, status: "RUNNING" } }, select: { id: true } });
      runId = run.id;
      const result = await repairHealthfix(db, organization.id, null, now);
      if (Object.values(result).some(Boolean)) changed++;
      await db.auditLog.update({ where: { id: runId }, data: { metadata: { ...metadata, status: "COMPLETED", completedAt: new Date().toISOString(), ...result } } });
    } catch {
      failed++;
      // Completion persistence can fail after committed repairs. Never claim rollback.
      if (runId) await db.auditLog.update({ where: { id: runId }, data: { metadata: { ...metadata, status: "FAILED", completedAt: new Date().toISOString(), error: "Run completion could not be confirmed. Review repair history before retrying." } } }).catch(() => undefined);
    }
  }
  return { checked: organizations.length, changed, failed };
}
