import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DIRECTORY_HOST, isLegacyHost, isSharedHost, managedPropertyHost } from "./property-host-policy";
import { normalizeStudentPhone } from "./student-identifiers";

export type RecoveryState = { error: string; message: string; complete?: boolean; kind?: RecoveryKind };
export type RecoveryKind = "MANAGEMENT" | "TENANT";
export type RecoveryConfig = { apiKey?: string; from?: string; secret?: string };
export const recoveryLifetime = 30 * 60 * 1000;
export const recoveryNotice = "If the details match an active account with a registered email, a reset link will be sent to that email. Check your inbox and spam folder. If no email arrives, contact your hostel management or use SYSTEM IN ONE for a linked management account.";
const notice: RecoveryState = { error: "", message: recoveryNotice };
const invalid: RecoveryState = { error: "This reset link is invalid, expired or already used. Request a new link from your hostel sign-in page.", message: "" };
const schema = z.object({ kind: z.enum(["MANAGEMENT", "TENANT"]), identifier: z.string().trim().min(5).max(254), hostel: z.string().max(300).optional() });
export const recoveryTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const validToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);
const normalizeEmail = (email: string) => email.trim().toLowerCase();
function canonicalHost(property: { publicListing: boolean; customDomain: string | null }) {
  return property.publicListing ? managedPropertyHost(property.customDomain) : DIRECTORY_HOST;
}
// Public input can select only a registered managed hostname. It never supplies the link origin.
export async function recoveryProperty(database: Pick<PrismaClient, "property">, host: string | null, hostel?: string) {
  const requested = isSharedHost(host) ? managedPropertyHost(hostel) : managedPropertyHost(host);
  if (!requested && !isLegacyHost(host)) return null;
  return database.property.findFirst({ where: { active: true, organization: { status: "ACTIVE" }, ...(isLegacyHost(host) ? { organizationId: "mama-mbugua-hostel", slug: "mmambugua-hostel", publicListing: true } : { customDomain: requested! }), ...(!isSharedHost(host) ? { publicListing: true } : {}) } });
}
async function withinLimit(database: PrismaClient, key: string, limit: number, secret: string, now: Date) {
  const bucket = Math.floor(now.getTime() / 3600000);
  const id = createHmac("sha256", secret).update(`${bucket}:${key}`).digest("hex");
  const rows = await database.$queryRaw<Array<{ attempts: number }>>`INSERT INTO "RecoveryRateLimit" (id,attempts,"createdAt") VALUES (${id},1,${now}) ON CONFLICT (id) DO UPDATE SET attempts=LEAST("RecoveryRateLimit".attempts+1,10001) RETURNING attempts`;
  return rows[0].attempts <= limit;
}
export async function requestPasswordRecovery(database: PrismaClient, input: unknown, host: string | null, config: RecoveryConfig = { apiKey: process.env.RESEND_API_KEY, from: process.env.RECEIPT_EMAIL_FROM, secret: process.env.SESSION_SECRET }, fetcher: typeof fetch = fetch, now = new Date(), schedule?: (task: () => Promise<void>) => void): Promise<RecoveryState> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Enter your registered email or tenant mobile number and your hostel website address.", message: "" };
  if (!host || (!isSharedHost(host) && !isLegacyHost(host) && !managedPropertyHost(host))) return notice;
  if (!config.apiKey || !config.from || !config.secret || config.secret.length < 16) return { error: "Email recovery is temporarily unavailable. Contact hostel management, or sign in with SYSTEM IN ONE if your management account is linked.", message: "" };
  const { kind, identifier, hostel } = parsed.data;
  const isEmail = z.string().email().safeParse(identifier).success;
  if (!isEmail && (kind !== "TENANT" || !/^[+0-9][0-9 ()+-]{5,24}$/.test(identifier))) return notice;
  try {
    if (!await withinLimit(database, "global", 1000, config.secret, now)) return notice;
    const property = await recoveryProperty(database, host, hostel);
    if (!property) return notice;
    const linkHost = canonicalHost(property);
    if (!linkHost) return notice;
    const identifierKey = isEmail ? normalizeEmail(identifier) : normalizeStudentPhone(identifier);
    if (!await withinLimit(database, `hostel:${property.organizationId}`, 100, config.secret, now) || !await withinLimit(database, `identifier:${property.organizationId}:${kind}:${identifierKey}`, 3, config.secret, now)) return notice;
    const account = await database.$transaction(async tx => {
      if (kind === "MANAGEMENT") {
        const users = await tx.user.findMany({ where: { organizationId: property.organizationId, email: { equals: identifierKey, mode: "insensitive" }, active: true }, take: 2 });
        if (users.length !== 1) return null;
        const user = users[0];
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
        const current = await tx.user.findFirst({ where: { id: user.id, active: true, organization: { status: "ACTIVE" }, email: { equals: identifierKey, mode: "insensitive" } } });
        return current ? { userId: current.id, studentId: null, sessionVersion: current.sessionVersion, email: current.email } : null;
      }
      const phoneIds = isEmail ? [] : await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Student" WHERE "organizationId"=${property.organizationId} AND CASE WHEN regexp_replace(phone,'[^0-9]','','g') LIKE '0%' THEN '254'||substring(regexp_replace(phone,'[^0-9]','','g') from 2) WHEN regexp_replace(phone,'[^0-9]','','g') ~ '^[17][0-9]{8}$' THEN '254'||regexp_replace(phone,'[^0-9]','','g') ELSE regexp_replace(phone,'[^0-9]','','g') END=${identifierKey} LIMIT 2`;
      const students = await tx.student.findMany({ where: { organizationId: property.organizationId, portalEnabled: true, portalPasswordHash: { not: null }, status: { not: "ARCHIVED" }, organization: { status: "ACTIVE" }, ...(isEmail ? { email: { equals: identifierKey, mode: "insensitive" } } : { id: { in: phoneIds.map(s => s.id) } }) }, take: 2 });
      if (students.length !== 1 || !students[0].email) return null;
      return { userId: null, studentId: students[0].id, sessionVersion: students[0].portalSessionVersion, email: students[0].email };
    });
    if (!account || !z.string().email().safeParse(account.email).success) return notice;
    // Account-level limit also covers tenant requests that alternate phone and email.
    if (!await withinLimit(database, `account:${kind}:${account.userId ?? account.studentId}`, 3, config.secret, now)) return notice;
    const token = randomBytes(32).toString("base64url"), id = randomUUID();
    await database.passwordRecovery.create({ data: { id, organizationId: property.organizationId, propertyId: property.id, kind, userId: account.userId, studentId: account.studentId, sessionVersion: account.sessionVersion, recipient: normalizeEmail(account.email), host: linkHost, tokenHash: recoveryTokenHash(token), expiresAt: new Date(now.getTime() + recoveryLifetime) } });
    const deliver = async () => {
    let deliveryStatus = "REVIEW";
    try {
      const response = await fetcher("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `hostel-recovery/${id}` }, body: JSON.stringify({ from: config.from, to: [normalizeEmail(account.email)], subject: `Reset your ${property.name} password`, text: `${property.name}\n\nReset your ${kind === "TENANT" ? "tenant" : "hostel management"} password using this private, single-use link:\nhttps://${linkHost}/reset-password/${token}\n\nThis link expires in 30 minutes. Your previous hostel sessions will be signed out after the password is changed. This does not change your SYSTEM IN ONE password.\n\nIf you did not request this, ignore this email. Your password has not changed. Do not forward this link.` }), signal: AbortSignal.timeout(10000) });
      if (response.ok) { const payload = await response.json(); deliveryStatus = typeof payload.id === "string" && payload.id ? "PROVIDER_ACCEPTED" : "REVIEW"; }
      else if (response.status >= 400 && response.status < 500 && response.status !== 408) deliveryStatus = "FAILED";
    } catch { /* Uncertain provider results are recorded without automatic resend. */ }
    await database.passwordRecovery.updateMany({ where: { id, deliveryStatus: "SENDING" }, data: { deliveryStatus } });
    };
    if (schedule) schedule(deliver); else await deliver();
    return notice;
  } catch { return notice; }
}
type RecoveryDB = Pick<Prisma.TransactionClient, "passwordRecovery" | "user" | "student">;
export async function usablePasswordRecovery(database: RecoveryDB, token: string, host: string | null, now = new Date()) {
  if (!validToken(token)) return null;
  const row = await database.passwordRecovery.findUnique({ where: { tokenHash: recoveryTokenHash(token) }, include: { property: { include: { organization: { select: { status: true } } } } } });
  if (!row || row.usedAt || row.expiresAt <= now || row.host !== host || !row.property.active || row.property.organization.status !== "ACTIVE" || canonicalHost(row.property) !== row.host) return null;
  if (row.kind === "MANAGEMENT" && row.userId) {
    const user = await database.user.findFirst({ where: { id: row.userId, organizationId: row.organizationId, active: true, sessionVersion: row.sessionVersion, email: { equals: row.recipient, mode: "insensitive" } } });
    return user ? row : null;
  }
  if (row.kind === "TENANT" && row.studentId) {
    const student = await database.student.findFirst({ where: { id: row.studentId, organizationId: row.organizationId, portalEnabled: true, portalPasswordHash: { not: null }, status: { not: "ARCHIVED" }, portalSessionVersion: row.sessionVersion, email: { equals: row.recipient, mode: "insensitive" } } });
    return student ? row : null;
  }
  return null;
}
export async function resetRecoveredPassword(database: PrismaClient, input: unknown, host: string | null, now = new Date()): Promise<RecoveryState> {
  const parsed = z.object({ token: z.string().max(128), password: z.string().min(12).max(128).refine(v => Buffer.byteLength(v, "utf8") <= 72), confirmation: z.string().max(128) }).refine(v => v.password === v.confirmation).safeParse(input);
  if (!parsed.success) return { error: "Use matching passwords of at least 12 characters, up to 72 UTF-8 bytes.", message: "" };
  try {
    const initial = await usablePasswordRecovery(database, parsed.data.token, host, now);
    if (!initial) return invalid;
    const passwordHash = await hash(parsed.data.password, 12);
    return await database.$transaction(async tx => {
      // Consistent account-first locking makes concurrent links and replay single-use.
      if (initial.userId) await tx.$queryRaw`SELECT id FROM "User" WHERE id=${initial.userId} FOR UPDATE`;
      else await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${initial.studentId} FOR UPDATE`;
      const checkedAt = new Date(Math.max(now.getTime(), Date.now()));
      const row = await usablePasswordRecovery(tx, parsed.data.token, host, checkedAt);
      if (!row) return invalid;
      if (row.userId) await tx.user.update({ where: { id: row.userId }, data: { passwordHash, sessionVersion: { increment: 1 } } });
      else await tx.student.update({ where: { id: row.studentId! }, data: { portalPasswordHash: passwordHash, portalSessionVersion: { increment: 1 } } });
      await tx.passwordRecovery.updateMany({ where: { usedAt: null, ...(row.userId ? { userId: row.userId } : { studentId: row.studentId! }) }, data: { usedAt: checkedAt } });
      await tx.auditLog.create({ data: { organizationId: row.organizationId, action: "ACCOUNT_PASSWORD_RECOVERED", entityType: row.userId ? "User" : "Student", entityId: row.userId ?? row.studentId!, metadata: { recoveryId: row.id, allHostelSessionsRevoked: true } } });
      return { error: "", message: "Your password has been reset and previous hostel sessions have been signed out. Sign in with your new password.", complete: true, kind: row.kind === "TENANT" ? "TENANT" : "MANAGEMENT" };
    }, { timeout: 15000 });
  } catch { return invalid; }
}

export async function prunePasswordRecovery(database: PrismaClient, now = new Date()) {
  const [limits, links, interrupted] = await Promise.all([
    database.recoveryRateLimit.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 2 * 86400000) } } }),
    database.passwordRecovery.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 30 * 86400000) } } }),
    database.passwordRecovery.updateMany({ where: { deliveryStatus: "SENDING", createdAt: { lt: new Date(now.getTime() - 15 * 60000) } }, data: { deliveryStatus: "REVIEW" } }),
  ]);
  return { expiredRateLimits: limits.count, oldRecoveryLinks: links.count, interruptedRecoveryEmails: interrupted.count };
}
