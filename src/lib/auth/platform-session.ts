import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const PLATFORM_SESSION_COOKIE = "systeminone_platform_session";
const PLATFORM_SESSION_DURATION_SECONDS = 60 * 60 * 8;

export type PlatformSessionPayload = {
  platformAdminId: string;
  name: string;
  role: "SUPER_ADMIN";
};

function getPlatformSessionSecret() {
  const value = process.env.PLATFORM_SESSION_SECRET;
  if (!value) throw new Error("PLATFORM_SESSION_SECRET is not configured");
  return new TextEncoder().encode(value);
}

export async function createPlatformSession(payload: PlatformSessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PLATFORM_SESSION_DURATION_SECONDS}s`)
    .sign(getPlatformSessionSecret());

  (await cookies()).set(PLATFORM_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/platform",
    maxAge: PLATFORM_SESSION_DURATION_SECONDS,
  });
}

export async function getPlatformSession(): Promise<PlatformSessionPayload | null> {
  const token = (await cookies()).get(PLATFORM_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getPlatformSessionSecret());
    if (payload.role !== "SUPER_ADMIN" || typeof payload.platformAdminId !== "string") return null;
    return payload as PlatformSessionPayload;
  } catch {
    return null;
  }
}

export async function requirePlatformSession() {
  const session = await getPlatformSession();
  if (!session) redirect("/platform/login");
  return session;
}

export async function deletePlatformSession() {
  (await cookies()).delete(PLATFORM_SESSION_COOKIE);
}
