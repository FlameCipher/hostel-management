import test from "node:test";
import assert from "node:assert/strict";
import { platformOrganizationAccess } from "../src/lib/platform-access";
const org = { platformOrganizationId: "org-a", platformProductCode: "STUDENTSHOSTELS" };
process.env.HOSTEL_SSO_SECRET = "isolated-test-bridge";
const response = (body: unknown, status = 200) => (async () => Response.json(body, { status })) as typeof fetch;
test("linked local logins require current access for the exact organization", async () => {
  assert.equal(await platformOrganizationAccess(org, undefined, response({ active: true, platformOrganizationId: "org-a" })), true);
  for (const body of [{ active: false, platformOrganizationId: "org-a" }, { active: true, platformOrganizationId: "org-b" }, {}]) assert.equal(await platformOrganizationAccess(org, undefined, response(body)), false);
  for (const status of [403, 503]) assert.equal(await platformOrganizationAccess(org, undefined, response({}, status)), false);
  assert.equal(await platformOrganizationAccess(org, undefined, (async () => { throw Error("offline"); }) as typeof fetch), false);
});
test("linked account removal or a central role downgrade denies local password access", async () => {
  const user = { platformUserId: "owner-a", role: "OWNER" };
  for (const role of ["ADMIN", "MEMBER"]) assert.equal(await platformOrganizationAccess(org, user, response({ active: true, platformOrganizationId: "org-a", platformUserId: "owner-a", role })), false);
  assert.equal(await platformOrganizationAccess(org, user, response({ active: true, platformOrganizationId: "org-a", platformUserId: "owner-a", role: "OWNER" })), true);
  assert.equal(await platformOrganizationAccess(org, user, response({ active: true, platformOrganizationId: "org-a", platformUserId: "owner-b", role: "OWNER" })), false);
});
test("legacy independent organizations do not make a platform request", async () => {
  assert.equal(await platformOrganizationAccess({ platformOrganizationId: null, platformProductCode: null }, undefined, (async () => { throw Error("must not call"); }) as typeof fetch), true);
});
