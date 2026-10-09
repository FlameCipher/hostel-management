import { requestPropertyContext } from "@/lib/property-host";
import { accountScopeAllowed } from "@/lib/property-host-policy";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentTenantSession, type TenantSession } from "@/lib/tenant-session-access";
export type { TenantSession } from "@/lib/tenant-session-access";

const COOKIE = "hostel_tenant_session";
const DURATION = 60 * 60 * 12;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured");
  return new TextEncoder().encode(value);
}

export async function createTenantSession(payload: TenantSession) {
  if (!Number.isSafeInteger(payload.sessionVersion) || (payload.sessionVersion ?? -1) < 0) throw new Error("TENANT_SESSION_VERSION_REQUIRED");
  const current = await currentTenantSession(db, payload);
  if (!current) throw new Error("TENANT_SESSION_REVOKED");
  const token = await new SignJWT(current).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${DURATION}s`).sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DURATION });
}

export async function getTenantSession(): Promise<TenantSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.studentId !== "string" || typeof payload.organizationId !== "string" || typeof payload.name !== "string") return null;
    const context=await requestPropertyContext();
    if(!accountScopeAllowed(context.host,context.property?.organizationId??null,payload.organizationId))return null;
    return await currentTenantSession(db, payload);
  } catch { return null; }
}

export async function requireTenantSession() {
  const session = await getTenantSession();
  if (!session) redirect("/tenant/login");
  return session;
}

export async function deleteTenantSession() {
  (await cookies()).delete(COOKIE);
}
