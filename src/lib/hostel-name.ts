import type { Prisma } from "@/generated/prisma/client";
export const hostelNameTaken = "This hostel name is already registered. Choose a different name, for example by adding your location.";
export function validHostelName(name: string) { return name.trim().length >= 3 && name.length <= 120 && /[\p{L}\p{N}]/u.test(name); }
export async function assertHostelNameAvailable(tx: Prisma.TransactionClient, name: string, organizationId?: string, propertyId?: string) {
  if (!validHostelName(name)) throw Error("INVALID_HOSTEL_NAME");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hostel-name:' || hostel_name_key(${name})))`;
  const matches = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Organization" WHERE hostel_name_key(name)=hostel_name_key(${name}) AND (${organizationId ?? null}::text IS NULL OR id<>${organizationId ?? null})
    UNION ALL SELECT id FROM "Property" WHERE hostel_name_key(name)=hostel_name_key(${name}) AND (${propertyId ?? null}::text IS NULL OR id<>${propertyId ?? null})
      AND (${organizationId ?? null}::text IS NULL OR "organizationId"<>${organizationId ?? null} OR ${propertyId ?? null}::text IS NOT NULL) LIMIT 1`;
  if (matches.length) throw Error("HOSTEL_NAME_TAKEN");
}
export function isHostelNameConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string; meta?: unknown };
  return value.message === "HOSTEL_NAME_TAKEN" || /hostel_name_(unique|claimed)|HOSTEL_NAME_TAKEN/.test(JSON.stringify(value.meta ?? {}) + (value.message ?? ""));
}
