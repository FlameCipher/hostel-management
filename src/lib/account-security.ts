import { compare, hash } from "bcryptjs";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { localSessionCurrent } from "@/lib/account-security-policy";
import { platformRoleAllows, verifyPlatformPassword } from "@/lib/platform-sso";
export type AccountSecurityState = { error: string };
const denied = { error: "Unable to update this account. Check your current password or sign in again." };
const inputSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("email"), currentPassword: z.string().min(1).max(128), email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), confirmEmail: z.string().trim().email().max(254).transform(v => v.toLowerCase()), confirmSignOut: z.literal(true) }),
  z.object({ operation: z.literal("password"), currentPassword: z.string().min(1).max(128), password: z.string().min(12).max(128).refine(v => Buffer.byteLength(v, "utf8") <= 72), confirmPassword: z.string().max(128), confirmSignOut: z.literal(true) }),
]);
export async function updateOwnAccount(database: PrismaClient, session: SessionPayload | null, input: unknown, verifyPassword = verifyPlatformPassword, now = new Date()): Promise<AccountSecurityState & { success?: true }> {
  if (!session) return denied;
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "Confirm the update. Use a valid matching email or a matching password of at least 12 characters and up to 72 UTF-8 bytes." };
  const data = parsed.data;
  if (data.operation === "email" && data.email !== data.confirmEmail || data.operation === "password" && data.password !== data.confirmPassword) return { error: "The confirmation does not match." };
  try {
    return await database.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${session.userId} AND "organizationId"=${session.organizationId} FOR UPDATE`;
      const user = await tx.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, active: true, organization: { status: "ACTIVE" } }, include: { organization: true } });
      if (!user || !localSessionCurrent(session.sessionVersion, user.sessionVersion)) return denied;
      const attempts = await tx.auditLog.count({ where: { organizationId: session.organizationId, entityId: session.userId, action: "ACCOUNT_SECURITY_ATTEMPT", createdAt: { gte: new Date(now.getTime() - 15 * 60000) } } });
      if (attempts >= 5) return { error: "Too many attempts. Try again in 15 minutes." };
      await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "ACCOUNT_SECURITY_ATTEMPT", entityType: "User", entityId: session.userId } });
      if (session.platformSubject) {
        const subject = session.platformSubject;
        if (user.platformUserId !== subject.platformUserId || user.organization.platformOrganizationId !== subject.platformOrganizationId || user.organization.platformProductCode !== "STUDENTSHOSTELS") return denied;
        const identity = await verifyPassword(subject, data.currentPassword);
        if (!identity || !platformRoleAllows(user.role, identity.role)) return denied;
      } else if (!await compare(data.currentPassword, user.passwordHash)) return denied;
      if (data.operation === "email") {
        if (user.email.toLowerCase() === data.email) return { error: "This is already your login email." };
        const duplicate = await tx.user.findFirst({ where: { organizationId: session.organizationId, email: { equals: data.email, mode: "insensitive" }, id: { not: user.id } }, select: { id: true } });
        if (duplicate) return { error: "That email cannot be used for this hostel account." };
      } else if (await compare(data.password, user.passwordHash)) return { error: "Choose a password different from your current hostel password." };
      await tx.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 }, ...(data.operation === "email" ? { email: data.email } : { passwordHash: await hash(data.password, 12) }) } });
      await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: user.id, action: data.operation === "email" ? "ACCOUNT_LOGIN_EMAIL_CHANGED" : "ACCOUNT_PASSWORD_CHANGED", entityType: "User", entityId: user.id, metadata: { allHostelSessionsRevoked: true } } });
      return { error: "", success: true };
    }, { timeout: 15000 });
  } catch { return { error: "The update could not be confirmed. Sign in again or try later." }; }
}
