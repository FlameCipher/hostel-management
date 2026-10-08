import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { localSessionCurrent } from "@/lib/account-security-policy";
import { platformIdentity, platformRoleAllows, validSubject } from "@/lib/platform-sso";
export const PHOTO_LIMIT = 12;
export const PHOTO_MAX_BYTES = 12 * 1024 * 1024;
const segment = /^[A-Za-z0-9_-]{1,128}$/;
export function propertyPhotoPathAllowed(pathname: string, organizationId: string, propertyId: string) {
  if (!segment.test(organizationId) || !segment.test(propertyId)) return false;
  const prefix = `properties/${organizationId}/${propertyId}/`;
  return pathname.startsWith(prefix) && /^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(pathname.slice(prefix.length));
}
export function propertyBlobAllowed(url: string, pathname: string) {
  try { const parsed = new URL(url); return parsed.protocol === "https:" && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.public\.blob\.vercel-storage\.com$/.test(parsed.hostname) && !parsed.port && !parsed.username && !parsed.password && !parsed.search && !parsed.hash && decodeURIComponent(parsed.pathname.slice(1)) === pathname; } catch { return false; }
}
async function manager(tx: Prisma.TransactionClient, session: Pick<SessionPayload, "userId" | "organizationId" | "sessionVersion">) {
  const user = await tx.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, active: true, role: { in: ["OWNER", "ADMIN"] }, organization: { status: "ACTIVE" } }, include: { organization: true } });
  if (!user || !localSessionCurrent(session.sessionVersion, user.sessionVersion)) throw Error("PHOTO_DENIED");
  return user;
}
export async function reservePropertyPhoto(database: PrismaClient, session: SessionPayload | null, propertyId: string, pathname: string, consent: boolean, now = new Date()) {
  if (!session || !consent || !propertyPhotoPathAllowed(pathname, session.organizationId, propertyId)) throw Error("PHOTO_DENIED");
  return database.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${session.userId} AND "organizationId"=${session.organizationId} FOR SHARE`;
    const user = await manager(tx, session);
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${propertyId} AND "organizationId"=${session.organizationId} FOR UPDATE`;
    const property = await tx.property.findFirst({ where: { id: propertyId, organizationId: session.organizationId, active: true, organization: { status: "ACTIVE" } }, select: { id: true, name: true } });
    if (!property) throw Error("PHOTO_DENIED");
    await tx.propertyPhoto.deleteMany({ where: { organizationId: session.organizationId, propertyId, url: null, deletedAt: null, expiresAt: { lte: now } } });
    const count = await tx.propertyPhoto.count({ where: { organizationId: session.organizationId, propertyId, deletedAt: null } });
    if (count >= PHOTO_LIMIT) throw Error("PHOTO_LIMIT");
    const expiresAt = new Date(now.getTime() + 15 * 60000);
    const photo = await tx.propertyPhoto.create({ data: { organizationId: session.organizationId, propertyId, uploadedById: user.id, pathname, caption: property.name, expiresAt } });
    return { photoId: photo.id, userId: user.id, organizationId: session.organizationId, propertyId, sessionVersion: user.sessionVersion, ...(session.platformSubject ? { platformSubject: session.platformSubject } : {}) };
  }, { timeout: 15000 });
}
const ticketSchema = z.object({ photoId: z.string().min(1).max(128), userId: z.string().min(1).max(128), organizationId: z.string().min(1).max(128), propertyId: z.string().min(1).max(128), sessionVersion: z.number().int().nonnegative(), platformSubject: z.unknown().optional() });
// Only handleUpload's authenticated provider callback invokes this function.
export async function completePropertyPhoto(database: PrismaClient, ticketInput: unknown, blob: { url: string; pathname: string }, now = new Date(), identityReader = platformIdentity) {
  const parsed = ticketSchema.safeParse(ticketInput);
  if (!parsed.success || !propertyPhotoPathAllowed(blob.pathname, parsed.data.organizationId, parsed.data.propertyId) || !propertyBlobAllowed(blob.url, blob.pathname)) throw Error("PHOTO_DENIED");
  const ticket = parsed.data;
  if (ticket.platformSubject !== undefined && !validSubject(ticket.platformSubject)) throw Error("PHOTO_DENIED");
  const identity = validSubject(ticket.platformSubject) ? await identityReader(ticket.platformSubject) : null;
  if (ticket.platformSubject !== undefined && !identity) throw Error("PHOTO_DENIED");
  await database.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${ticket.userId} AND "organizationId"=${ticket.organizationId} FOR SHARE`;
    const user = await manager(tx, ticket);
    if (identity && (user.platformUserId !== identity.platformUserId || user.organization.platformOrganizationId !== identity.platformOrganizationId || user.organization.platformProductCode !== "STUDENTSHOSTELS" || !platformRoleAllows(user.role, identity.role))) throw Error("PHOTO_DENIED");
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${ticket.propertyId} AND "organizationId"=${ticket.organizationId} FOR UPDATE`;
    const property = await tx.property.findFirst({ where: { id: ticket.propertyId, organizationId: ticket.organizationId, active: true, organization: { status: "ACTIVE" } }, select: { id: true } });
    if (!property) throw Error("PHOTO_DENIED");
    const photo = await tx.propertyPhoto.findFirst({ where: { id: ticket.photoId, organizationId: ticket.organizationId, propertyId: ticket.propertyId, uploadedById: ticket.userId, pathname: blob.pathname } });
    if (!photo || photo.deletedAt) return;
    if (photo.url) { if (photo.url !== blob.url) throw Error("PHOTO_DENIED"); return; }
    if (!photo.expiresAt || photo.expiresAt <= now) throw Error("PHOTO_EXPIRED");
    const cover = await tx.propertyPhoto.count({ where: { propertyId: ticket.propertyId, organizationId: ticket.organizationId, deletedAt: null, visible: true, isCover: true } });
    await tx.propertyPhoto.update({ where: { id: photo.id }, data: { url: blob.url, visible: true, isCover: cover === 0, expiresAt: null } });
    await tx.auditLog.create({ data: { organizationId: ticket.organizationId, actorUserId: user.id, action: "PROPERTY_PHOTO_PUBLISHED", entityType: "PropertyPhoto", entityId: photo.id } });
  }, { timeout: 15000 });
}
const editSchema = z.object({ id: z.string().min(1).max(128), operation: z.enum(["caption", "cover", "delete"]), caption: z.string().trim().max(240).optional(), visible: z.boolean().optional() });
export async function editPropertyPhoto(database: PrismaClient, session: SessionPayload | null, input: unknown, now = new Date()) {
  if (!session) throw Error("PHOTO_DENIED");
  const parsed = editSchema.safeParse(input); if (!parsed.success) throw Error("PHOTO_DENIED");
  return database.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${session.userId} AND "organizationId"=${session.organizationId} FOR SHARE`;
    const user = await manager(tx, session);
    const hint = await tx.propertyPhoto.findFirst({ where: { id: parsed.data.id, organizationId: session.organizationId }, select: { propertyId: true } });
    if (!hint) throw Error("PHOTO_DENIED");
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${hint.propertyId} AND "organizationId"=${session.organizationId} FOR UPDATE`;
    const photo = await tx.propertyPhoto.findFirst({ where: { id: parsed.data.id, organizationId: session.organizationId, property: { active: true, organization: { status: "ACTIVE" } } } });
    if (!photo) throw Error("PHOTO_DENIED");
    const { operation } = parsed.data;
    if (operation !== "delete" && (!photo.url || photo.deletedAt)) throw Error("PHOTO_DENIED");
    if (operation === "cover") {
      if (!photo.visible) throw Error("PHOTO_DENIED");
      await tx.propertyPhoto.updateMany({ where: { propertyId: photo.propertyId, organizationId: session.organizationId, isCover: true }, data: { isCover: false } });
      await tx.propertyPhoto.update({ where: { id: photo.id }, data: { isCover: true } });
    } else await tx.propertyPhoto.update({ where: { id: photo.id }, data: operation === "delete" ? { deletedAt: photo.deletedAt ?? now, visible: false, isCover: false } : { caption: parsed.data.caption ?? "", visible: parsed.data.visible === true, ...(parsed.data.visible ? {} : { isCover: false }) } });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: user.id, action: operation === "delete" ? "PROPERTY_PHOTO_REMOVED" : "PROPERTY_PHOTO_UPDATED", entityType: "PropertyPhoto", entityId: photo.id } });
    return { id: photo.id, deletionUrl: operation === "delete" && photo.url && propertyBlobAllowed(photo.url, photo.pathname) ? photo.url : null };
  }, { timeout: 15000 });
}
