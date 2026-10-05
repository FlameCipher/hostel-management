import assert from "node:assert/strict";

type Tenant = { id: string; platformOrganizationId: string | null };

function resolvePlatformTenant(tenants: Tenant[], platformOrganizationId: string) {
  const matches = tenants.filter((tenant) => tenant.platformOrganizationId === platformOrganizationId);
  if (matches.length > 1) throw new Error("Platform identity collision");
  return matches[0] ?? null;
}

const mmambugua: Tenant = { id: "mmambugua-existing", platformOrganizationId: null };
const sampesa: Tenant = { id: "sampesa-new", platformOrganizationId: "systeminone-org-sampesa" };

assert.equal(resolvePlatformTenant([mmambugua], "systeminone-org-sampesa"), null);
assert.equal(resolvePlatformTenant([mmambugua, sampesa], "systeminone-org-sampesa")?.id, "sampesa-new");
assert.notEqual(resolvePlatformTenant([mmambugua, sampesa], "systeminone-org-sampesa")?.id, mmambugua.id);

assert.throws(
  () => resolvePlatformTenant([
    sampesa,
    { id: "collision", platformOrganizationId: "systeminone-org-sampesa" },
  ], "systeminone-org-sampesa"),
  /collision/,
);

console.log("Platform tenant isolation invariants passed.");
