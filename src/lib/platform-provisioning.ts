import type { PrismaClient } from "@/generated/prisma/client";
import { assertHostelNameAvailable } from "./hostel-name";
import { propertyAddress } from "./property-address";
import { platformIdentity, validSubject } from "./platform-sso";

export async function provisionHostel(database: PrismaClient, input: unknown, identityReader = platformIdentity) {
  if (!input || typeof input !== "object" || !validSubject(input)) throw Error("INVALID_REQUEST");
  const body = input as typeof input & { productCode?: unknown; organizationName?: unknown; phone?: unknown };
  if (body.productCode !== "STUDENTSHOSTELS" || typeof body.organizationName !== "string" || body.organizationName.trim().length < 3 || body.organizationName.length > 120 || typeof body.phone !== "string" || !/^\+?[0-9][0-9 ()-]{8,19}$/.test(body.phone)) throw Error("INVALID_REQUEST");
  const identity = await identityReader(body);
  if (!identity || identity.role !== "OWNER") throw Error("ACCESS_UNAVAILABLE");
  const name = body.organizationName.trim(), phone = body.phone.trim();
  return database.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"hostel-platform:" + identity.platformOrganizationId}))`;
    const existing = await tx.organization.findUnique({ where: { platformOrganizationId: identity.platformOrganizationId } });
    if (existing) {
      if (existing.platformProductCode !== "STUDENTSHOSTELS" || existing.status !== "ACTIVE") throw Error("ACCESS_UNAVAILABLE");
      return { organizationId: existing.id, status: "EXISTING" };
    }
    await assertHostelNameAvailable(tx, name);
    const address = propertyAddress(name, identity.platformOrganizationId);
    // Serializes different organizations requesting the same website label.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"hostel-address:" + address}))`;
    const chosen = await tx.property.findUnique({ where: { customDomain: address }, select: { id: true } }) ? propertyAddress(name, identity.platformOrganizationId, true) : address;
    const organization = await tx.organization.create({ data: {
      platformOrganizationId: identity.platformOrganizationId, platformProductCode: "STUDENTSHOSTELS", platformBootstrapAllowed: true,
      name, ownerName: identity.userName, phone, email: identity.email, receiptPrefix: "SH", status: "ACTIVE",
    } });
    await tx.property.create({ data: { organizationId: organization.id, slug: chosen.split(".")[0], name, phone, email: identity.email, customDomain: chosen, publicListing: false } });
    await tx.auditLog.create({ data: { organizationId: organization.id, action: "PLATFORM_WORKSPACE_CREATED", entityType: "Organization", entityId: organization.id, metadata: { platformOrganizationId: identity.platformOrganizationId, platformUserId: identity.platformUserId } } });
    return { organizationId: organization.id, status: "CREATED" };
  });
}
