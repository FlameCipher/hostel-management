import { hash } from "bcryptjs";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "./auth/session";
import { platformOrganizationAccess } from "./platform-access";
import { normalizeStaffPhone, validDutyTimeZone } from "./staff-phone-policy";

const schema = z.object({
  name: z.string().trim().min(2).max(100), email: z.string().trim().max(254).refine(v => !v || z.string().email().safeParse(v).success).transform(v => v.toLowerCase()),
  phone: z.string().trim().max(30), role: z.enum(["OWNER", "ADMIN", "MANAGER", "CARETAKER"]), active: z.boolean(),
  dutyStart: z.string().default(""), dutyEnd: z.string().default(""), dutyTimeZone: z.string().trim().max(80).default(""),
  password: z.string().max(128).refine(v => !v || (v.length >= 12 && Buffer.byteLength(v, "utf8") <= 72)),
}).superRefine((data, ctx) => {
  if (!data.email && (data.role !== "CARETAKER" || !normalizeStaffPhone(data.phone)))
    ctx.addIssue({ code: "custom", path: ["email"], message: "A caretaker without email needs an international phone number, starting with + and the country code. Other roles require email." });
  if ((data.dutyStart || data.dutyEnd) && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.dutyStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.dutyEnd) || data.dutyStart === data.dutyEnd || !validDutyTimeZone(data.dutyTimeZone)))
    ctx.addIssue({ code: "custom", path: ["dutyStart"], message: "Enter both duty times and a valid time zone. Start and end must differ." });
});
export async function saveHostelStaff(database: PrismaClient, session: SessionPayload, id: string | null, input: unknown, accessReader = platformOrganizationAccess): Promise<{ error: string; success?: true }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the staff details." };
  if (!id && !parsed.data.password) return { error: "A private temporary password of at least 12 characters is required." };
  const data = parsed.data;
  return database.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "User" WHERE "organizationId"=${session.organizationId} AND id=${session.userId} FOR UPDATE`;
    const actor = await tx.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, active: true }, include: { organization: true } });
    if (!actor || actor.organization.status !== "ACTIVE" || actor.sessionVersion !== session.sessionVersion || !["OWNER", "ADMIN"].includes(actor.role) || !await accessReader(actor.organization, actor)) return { error: "Active hostel access and owner or admin permissions are required." };
    const target = id ? await tx.user.findFirst({ where: { id, organizationId: session.organizationId } }) : null;
    if (id && !target) return { error: "User not found." };
    if ((target?.role === "OWNER" || data.role === "OWNER") && actor.role !== "OWNER") return { error: "Only an owner can manage owner accounts." };
    if (id === actor.id && (data.password || data.email !== (actor.email ?? "").toLowerCase())) return { error: "Use My Account to change your own login email or password." };
    if (id === actor.id && !data.active) return { error: "You cannot deactivate your own account." };
    if (target?.active && target.role === "OWNER" && (!data.active || data.role !== "OWNER") && await tx.user.count({ where: { organizationId: session.organizationId, active: true, role: "OWNER" } }) <= 1) return { error: "Keep at least one active owner for this hostel." };
    if (data.email && await tx.user.findFirst({ where: { organizationId: session.organizationId, email: { equals: data.email, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })) return { error: "That email address is already registered." };
    const phoneLogin = data.role === "CARETAKER" && (!data.email || Boolean(target?.loginPhone));
    const loginPhone = phoneLogin ? normalizeStaffPhone(data.phone) : null;
    if (phoneLogin && !loginPhone) return { error: "Enter the caretaker's international phone number, starting with + and the country code." };
    if (loginPhone && await tx.user.findFirst({ where: { organizationId: session.organizationId, loginPhone, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })) return { error: "That phone number is already used for a staff login at this hostel." };
    const { password, ...profile } = data;
    const values = { ...profile, email: profile.email || null, phone: loginPhone ?? (profile.phone || null), loginPhone,
      dutyStart: profile.dutyStart || null, dutyEnd: profile.dutyEnd || null, dutyTimeZone: profile.dutyStart ? profile.dutyTimeZone : null };
    const revoke = Boolean(target && (password || data.email !== (target.email ?? "").toLowerCase() || loginPhone !== (target.loginPhone ?? null) || data.role !== target.role || data.active !== target.active));
    const user = target ? await tx.user.update({ where: { id: target.id }, data: { ...values, ...(password ? { passwordHash: await hash(password, 12) } : {}), ...(revoke ? { sessionVersion: { increment: 1 } } : {}) } }) : await tx.user.create({ data: { ...values, organizationId: session.organizationId, passwordHash: await hash(password, 12) } });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: actor.id, action: target ? "STAFF_ACCOUNT_UPDATED" : "STAFF_ACCOUNT_CREATED", entityType: "User", entityId: user.id, metadata: { role: data.role, active: data.active, sessionsRevoked: revoke, phoneLogin: Boolean(loginPhone), dutyStart: values.dutyStart, dutyEnd: values.dutyEnd, dutyTimeZone: values.dutyTimeZone } } });
    return { error: "", success: true };
  }, { timeout: 15000 });
}
