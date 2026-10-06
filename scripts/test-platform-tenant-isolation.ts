import assert from "node:assert/strict";
import { createHash, timingSafeEqual } from "node:crypto";

const PRODUCT_CODE = "STUDENTSHOSTELS";

type Tenant = {
  id: string;
  name: string;
  platformOrganizationId: string | null;
  platformProductCode: string | null;
};

type RequestBody = {
  platformOrganizationId?: string;
  productCode?: string;
  organizationName?: string;
  ownerName?: string;
  phone?: string;
  email?: string;
};

function secretMatches(expected: string | undefined, supplied: string | undefined) {
  if (!expected || !supplied) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(a, b);
}

function validate(body: RequestBody | null) {
  return Boolean(
    body?.platformOrganizationId &&
    body.productCode === PRODUCT_CODE &&
    body.organizationName &&
    body.ownerName &&
    body.phone,
  );
}

function provision(tenants: Tenant[], body: RequestBody) {
  assert.equal(validate(body), true, "request must satisfy provisioning contract");

  const existing = tenants.find(
    (tenant) => tenant.platformOrganizationId === body.platformOrganizationId,
  );

  if (existing) {
    if (existing.platformProductCode !== PRODUCT_CODE) {
      return { status: 409, organizationId: null, result: "PRODUCT_MISMATCH" as const };
    }
    return { status: 200, organizationId: existing.id, result: "EXISTING" as const };
  }

  const created: Tenant = {
    id: `tenant-${tenants.length + 1}`,
    name: body.organizationName!,
    platformOrganizationId: body.platformOrganizationId!,
    platformProductCode: PRODUCT_CODE,
  };
  tenants.push(created);
  return { status: 201, organizationId: created.id, result: "CREATED" as const };
}

const mmambugua: Tenant = {
  id: "mmambugua-existing",
  name: "MMAMBUGUA HOSTEL",
  platformOrganizationId: null,
  platformProductCode: null,
};

const tenants: Tenant[] = [mmambugua];
const dummy: RequestBody = {
  platformOrganizationId: "systeminone-e2e-dummy",
  productCode: PRODUCT_CODE,
  organizationName: "SYSTEM IN ONE E2E DUMMY",
  ownerName: "E2E Test Owner",
  phone: "+254700000001",
  email: "e2e.invalid@example.invalid",
};

assert.equal(secretMatches(undefined, "x"), false);
assert.equal(secretMatches("secret-a", undefined), false);
assert.equal(secretMatches("secret-a", "secret-b"), false);
assert.equal(secretMatches("secret-a", "secret-a"), true);

assert.equal(validate({ ...dummy, productCode: "OTHER" }), false);
assert.equal(validate({ ...dummy, phone: "" }), false);

const first = provision(tenants, dummy);
assert.equal(first.status, 201);
assert.equal(first.result, "CREATED");
assert.notEqual(first.organizationId, mmambugua.id);
assert.equal(tenants.length, 2);
assert.equal(tenants[0], mmambugua, "MMAMBUGUA record must remain untouched");
assert.equal(mmambugua.platformOrganizationId, null, "MMAMBUGUA must remain unbound");

const retry = provision(tenants, dummy);
assert.equal(retry.status, 200);
assert.equal(retry.result, "EXISTING");
assert.equal(retry.organizationId, first.organizationId, "retry must be idempotent");
assert.equal(tenants.length, 2, "retry must not create a second tenant");

tenants.push({
  id: "foreign-product",
  name: "Foreign product tenant",
  platformOrganizationId: "systeminone-product-mismatch",
  platformProductCode: "OTHER",
});
const mismatch = provision(tenants, {
  ...dummy,
  platformOrganizationId: "systeminone-product-mismatch",
});
assert.equal(mismatch.status, 409);
assert.equal(mismatch.result, "PRODUCT_MISMATCH");

console.log("Provisioning contract regression invariants passed.");
