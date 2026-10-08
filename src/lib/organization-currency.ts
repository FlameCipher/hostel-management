import { cache } from "react";
import { db } from "./db";
import { requireSession } from "./auth/session";
export const organizationCurrency = cache(async (organizationId: string) => {
  const organization = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { currency: true } });
  return organization.currency;
});
export async function managementCurrency() {
  return organizationCurrency((await requireSession()).organizationId);
}
