import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { createHmac } from "node:crypto";

const COOKIE_NAME = "student_update_session";
const SESSION_SECONDS = 15 * 60;

export type StudentUpdateSession = {
  studentId: string;
  organizationId: string;
  submittedName: string;
  submittedPhone: string;
};

function secretText() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured");
  return value;
}

function secretKey() {
  return new TextEncoder().encode(secretText());
}

export async function createStudentUpdateSession(payload: StudentUpdateSession) {
  const token = await new SignJWT({ ...payload, purpose: "student-details-update" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/update-details",
    maxAge: SESSION_SECONDS,
  });
}

export async function getStudentUpdateSession(): Promise<StudentUpdateSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== "student-details-update") return null;
    if (typeof payload.studentId !== "string" || typeof payload.organizationId !== "string" || typeof payload.submittedName !== "string" || typeof payload.submittedPhone !== "string") return null;
    return { studentId: payload.studentId, organizationId: payload.organizationId, submittedName: payload.submittedName, submittedPhone: payload.submittedPhone };
  } catch {
    return null;
  }
}

export async function clearStudentUpdateSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function getPublicLookupFingerprint() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || requestHeaders.get("x-real-ip") || "unknown";
  const agent = requestHeaders.get("user-agent") || "unknown";
  return createHmac("sha256", secretText()).update(`${address}|${agent}`).digest("hex");
}
