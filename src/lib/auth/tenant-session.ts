import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "hostel_tenant_session";
const DURATION = 60 * 60 * 12;

export type TenantSession = { studentId: string; organizationId: string; name: string };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured");
  return new TextEncoder().encode(value);
}

export async function createTenantSession(payload: TenantSession) {
  const token = await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${DURATION}s`).sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DURATION });
}

export async function getTenantSession(): Promise<TenantSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.studentId !== "string" || typeof payload.organizationId !== "string" || typeof payload.name !== "string") return null;
    return { studentId: payload.studentId, organizationId: payload.organizationId, name: payload.name };
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
