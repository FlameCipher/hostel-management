import { createHash, randomBytes } from 'node:crypto';
import {bootstrapOwnerAllowed} from '@/lib/landlord-onboarding-policy';
import { compare, hash } from 'bcryptjs';
import type { PrismaClient } from '@/generated/prisma/client';
import type { SessionPayload } from '@/lib/auth/session';
export type PlatformSubject = { platformUserId: string; platformOrganizationId: string; sessionVersion: number };
export type PlatformIdentity = PlatformSubject & { userName: string; email: string; organizationName: string; role: string };
export function platformRoleAllows(hostelRole: string, platformRole: string) {
  return hostelRole === 'OWNER' ? platformRole === 'OWNER' : ['ADMIN','MANAGER'].includes(hostelRole) ? ['OWNER','ADMIN'].includes(platformRole) : hostelRole === 'CARETAKER' && ['OWNER','ADMIN','MEMBER'].includes(platformRole);
}
export const ssoHash = (value: string) => createHash('sha256').update(value).digest('base64url');
export const validOpaque = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);
export function validSubject(v: unknown): v is PlatformSubject {
  if (!v || typeof v !== 'object') return false;
  const s = v as PlatformSubject;
  return [s.platformUserId,s.platformOrganizationId].every(x => typeof x === 'string' && x.length > 0 && x.length <= 128) && Number.isSafeInteger(s.sessionVersion) && s.sessionVersion >= 0;
}
export async function platformIdentity(subject: PlatformSubject, fetcher: typeof fetch = fetch): Promise<PlatformIdentity | null> {
  const secret = process.env.HOSTEL_SSO_SECRET;
  if (!secret || !validSubject(subject)) return null;
  try {
    const r = await fetcher('https://systeminone.com/api/hostel/sso/identity', { method:'POST', headers:{'content-type':'application/json','x-hostel-sso-secret':secret}, body:JSON.stringify({platformUserId:subject.platformUserId,platformOrganizationId:subject.platformOrganizationId,sessionVersion:subject.sessionVersion}), cache:'no-store', redirect:'error', signal:AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const v = await r.json() as PlatformIdentity;
    return validSubject(v) && v.platformUserId === subject.platformUserId && v.platformOrganizationId === subject.platformOrganizationId && v.sessionVersion === subject.sessionVersion && typeof v.email === 'string' && typeof v.userName === 'string' && typeof v.organizationName === 'string' && ['OWNER','ADMIN','MEMBER'].includes(v.role) ? v : null;
  } catch { return null; }
}
export async function issueSsoGrant(db: PrismaClient, subject: PlatformSubject, challenge: string, now = new Date()) {
  if (!validSubject(subject) || !validOpaque(challenge)) throw Error('SSO_DENIED');
  const code = randomBytes(32).toString('base64url');
  await db.platformSsoGrant.create({ data:{ platformUserId:subject.platformUserId, platformOrganizationId:subject.platformOrganizationId, sessionVersion:subject.sessionVersion, challenge, tokenHash:ssoHash(code), expiresAt:new Date(now.getTime()+5*60000) } });
  return code;
}
export async function pendingSso(db: PrismaClient, code: string, verifier: string, now = new Date()) {
  if (!validOpaque(code) || !validOpaque(verifier)) return null;
  return db.platformSsoGrant.findFirst({ where:{tokenHash:ssoHash(code),challenge:ssoHash(verifier),consumedAt:null,expiresAt:{gt:now},attempts:{lt:5}} });
}
export async function consumeSso(db: PrismaClient, code: string, verifier: string, identity: PlatformIdentity, proof?: {userId:string;organizationId:string;password:string} | {bootstrap:true}, now = new Date()): Promise<SessionPayload> {
  if (!validOpaque(code) || !validOpaque(verifier)) throw Error('SSO_DENIED');
  const attempt = await db.platformSsoGrant.updateMany({where:{tokenHash:ssoHash(code),challenge:ssoHash(verifier),consumedAt:null,expiresAt:{gt:now},attempts:{lt:5}},data:{attempts:{increment:1}}});
  if (attempt.count !== 1) throw Error('SSO_DENIED');
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "PlatformSsoGrant" WHERE "tokenHash"=${ssoHash(code)} FOR UPDATE`;
    const grant = await tx.platformSsoGrant.findFirst({where:{tokenHash:ssoHash(code),challenge:ssoHash(verifier),consumedAt:null,expiresAt:{gt:now},attempts:{lte:5}}});
    if (!grant || !validSubject(identity) || grant.platformUserId !== identity.platformUserId || grant.platformOrganizationId !== identity.platformOrganizationId || grant.sessionVersion !== identity.sessionVersion) throw Error('SSO_DENIED');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"hostel-platform:"+identity.platformOrganizationId}))`;
    let user = await tx.user.findFirst({ where:{platformUserId:identity.platformUserId,active:true,organization:{platformOrganizationId:identity.platformOrganizationId,platformProductCode:'STUDENTSHOSTELS',status:'ACTIVE'}},include:{organization:true} });
    if (!user && proof && 'bootstrap' in proof) {
      const org=await tx.organization.findUnique({where:{platformOrganizationId:identity.platformOrganizationId}});
      if(!org)throw Error('SSO_DENIED');
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${org.id} FOR UPDATE`;
      const current=await tx.organization.findUniqueOrThrow({where:{id:org.id}});
      const users=await tx.user.count({where:{organizationId:org.id}});
      if(!bootstrapOwnerAllowed({enabled:current.platformBootstrapAllowed,active:current.status==='ACTIVE',product:current.platformProductCode,role:identity.role,users}))throw Error('SSO_DENIED');
      user=await tx.user.create({data:{organizationId:org.id,platformUserId:identity.platformUserId,name:identity.userName,email:identity.email.toLowerCase(),role:'OWNER',active:true,passwordHash:await hash(randomBytes(48).toString('base64url'),12)},include:{organization:true}});
      await tx.organization.update({where:{id:org.id},data:{platformBootstrapAllowed:false,ownerName:identity.userName}});
      await tx.auditLog.create({data:{organizationId:org.id,actorUserId:user.id,action:'PLATFORM_FIRST_OWNER_CREATED',entityType:'User',entityId:user.id}});
    }
    if (!user && proof && !('bootstrap' in proof)) {
      if (proof.password.length < 8 || proof.password.length > 128) throw Error('SSO_DENIED');
      user = await tx.user.findFirst({where:{id:proof.userId,organizationId:proof.organizationId,active:true,organization:{status:'ACTIVE'}},include:{organization:true}});
      if (!user || !await compare(proof.password,user.passwordHash)) throw Error('SSO_DENIED');
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${user.organizationId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
      user = await tx.user.findUnique({where:{id:user.id},include:{organization:true}});
      if (!user?.active || user.organization.status !== 'ACTIVE' || !await compare(proof.password,user.passwordHash)) throw Error('SSO_DENIED');
      if (user.platformUserId && user.platformUserId !== identity.platformUserId) throw Error('SSO_DENIED');
      const org = user.organization;
      if (org.platformOrganizationId && (org.platformOrganizationId !== identity.platformOrganizationId || org.platformProductCode !== 'STUDENTSHOSTELS')) throw Error('SSO_DENIED');
      if (!org.platformOrganizationId && (user.role !== 'OWNER' || identity.role !== 'OWNER')) throw Error('SSO_DENIED');
      if (!platformRoleAllows(user.role, identity.role)) throw Error('SSO_DENIED');
      await tx.organization.update({where:{id:org.id},data:{platformOrganizationId:identity.platformOrganizationId,platformProductCode:'STUDENTSHOSTELS'}});
      await tx.user.update({where:{id:user.id},data:{platformUserId:identity.platformUserId}});
      await tx.auditLog.create({data:{organizationId:org.id,actorUserId:user.id,action:'PLATFORM_ACCOUNT_LINKED',entityType:'User',entityId:user.id,metadata:{platformUserId:identity.platformUserId,platformOrganizationId:identity.platformOrganizationId}}});
    }
    if (!user) throw Error('SSO_LINK_REQUIRED');
    if (!platformRoleAllows(user.role, identity.role)) throw Error('SSO_DENIED');
    await tx.platformSsoGrant.update({where:{id:grant.id},data:{consumedAt:now}});
    await tx.auditLog.create({data:{organizationId:user.organizationId,actorUserId:user.id,action:'PLATFORM_SIGN_IN',entityType:'User',entityId:user.id}});
    return {userId:user.id,organizationId:user.organizationId,name:user.name,role:user.role,platformSubject:{platformUserId:identity.platformUserId,platformOrganizationId:identity.platformOrganizationId,sessionVersion:identity.sessionVersion}};
  },{timeout:15000});
}
