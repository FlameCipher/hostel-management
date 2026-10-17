import { createHmac } from "node:crypto";
import { compare } from "bcryptjs";
import type { PrismaClient } from "@/generated/prisma/client";
import { normalizeStaffPhone } from "./staff-phone-policy";

/** Restricted to a resolved hostel. Uses the normal password and session checks. */
export async function authenticateCaretakerPhone(
  database: PrismaClient, input: { identifier: string; password: string },
  property: { organizationId: string; countryCode: string | null } | null,
  secret = process.env.SESSION_SECRET, now = new Date(),
  verify: (plain: string, hash: string) => Promise<boolean> = compare,
) {
  if (!property || !secret || input.password.length < 8 || input.password.length > 128) return null;
  const phone = normalizeStaffPhone(input.identifier, property.countryCode ?? (property.organizationId === "mama-mbugua-hostel" ? "KE" : null));
  if (!phone) return null;
  const bucket = Math.floor(now.getTime() / (15 * 60000));
  const key = createHmac("sha256", secret).update(`staff-phone:${bucket}:${property.organizationId}:${phone}`).digest("hex");
  const attempts = await database.$queryRaw<Array<{ attempts: number }>>`
    INSERT INTO "RecoveryRateLimit" (id,attempts,"createdAt") VALUES (${key},1,${now})
    ON CONFLICT (id) DO UPDATE SET attempts=LEAST("RecoveryRateLimit".attempts+1,10001) RETURNING attempts`;
  if (!attempts[0] || attempts[0].attempts > 8) return null;
  const users = await database.user.findMany({
    where: { organizationId: property.organizationId, loginPhone: phone, role: "CARETAKER", active: true, organization: { status: "ACTIVE" } },
    take: 2,
    select: { id: true, organizationId: true, name: true, role: true, passwordHash: true, sessionVersion: true },
  });
  if (users.length !== 1 || !await verify(input.password, users[0].passwordHash)) return null;
  return users[0];
}
