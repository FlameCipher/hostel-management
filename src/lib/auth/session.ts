import { requestPropertyContext } from "@/lib/property-host";
import { accountScopeAllowed } from "@/lib/property-host-policy";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { platformIdentity, platformRoleAllows, validSubject, type PlatformSubject } from "@/lib/platform-sso";

const SESSION_COOKIE = "hostel_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

export type SessionPayload = {
  platformSubject?: PlatformSubject;
  userId: string;
  organizationId: string;
  name: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "CARETAKER";
};

function getSessionSecret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured");
  return new TextEncoder().encode(value);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    const session = payload as SessionPayload;
    if(typeof session.userId!=="string" || typeof session.organizationId!=="string") return null;
    const context=await requestPropertyContext();
    if(!accountScopeAllowed(context.host,context.property?.organizationId??null,session.organizationId)) return null;
    const current=await db.user.findFirst({where:{id:session.userId,organizationId:session.organizationId,active:true,organization:{status:"ACTIVE"}},select:{name:true,role:true}});
    if(!current) return null;
    session.name=current.name;session.role=current.role;
    if (session.platformSubject) {
      if (!validSubject(session.platformSubject)) return null;
      const identity = await platformIdentity(session.platformSubject);
      if (!identity) return null;
      const user = await db.user.findFirst({where:{id:session.userId,organizationId:session.organizationId,active:true,platformUserId:session.platformSubject.platformUserId,organization:{status:"ACTIVE",platformOrganizationId:session.platformSubject.platformOrganizationId,platformProductCode:"STUDENTSHOSTELS"}},select:{name:true,role:true}});
      if (!user || !platformRoleAllows(user.role, identity.role)) return null;
      return {...session,name:user.name,role:user.role};
    }
    return session;
  } catch {
    return null;
  }
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
