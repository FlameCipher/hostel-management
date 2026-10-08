import test from "node:test";
import assert from "node:assert/strict";
import { hash, compare } from "bcryptjs";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { SessionPayload } from "../src/lib/auth/session";
import { updateOwnAccount } from "../src/lib/account-security";
import { localSessionCurrent } from "../src/lib/account-security-policy";
import { verifyPlatformPassword, type PlatformIdentity } from "../src/lib/platform-sso";
const session: SessionPayload = { userId: "owner", organizationId: "one", role: "OWNER", name: "Owner", sessionVersion: 0 };
const passwordInput = { operation: "password", currentPassword: "FAKE-old-password", password: "FAKE-new-password-123", confirmPassword: "FAKE-new-password-123", confirmSignOut: true };
const emailInput = { operation: "email", currentPassword: "FAKE-old-password", email: "New@Example.invalid", confirmEmail: "new@example.invalid", confirmSignOut: true };
async function fixture(overrides: Record<string, unknown> = {}, attempts = 0, duplicate = false) {
  const audits: unknown[] = [], updates: Record<string, unknown>[] = [], queries: unknown[] = [];
  const user = { id: "owner", organizationId: "one", role: "OWNER", email: "old@example.invalid", active: true, sessionVersion: 0, passwordHash: await hash("FAKE-old-password", 4), platformUserId: null, organization: { status: "ACTIVE", platformOrganizationId: null, platformProductCode: null }, ...overrides };
  const tx = { $queryRaw: async () => [], user: { findFirst: async (query: { where: { id?: unknown } }) => { queries.push(query); return query.where.id && typeof query.where.id === "object" ? duplicate ? { id: "other" } : null : user; }, update: async (query: { data: Record<string, unknown> }) => { updates.push(query.data); return {}; } }, auditLog: { count: async (query: unknown) => { queries.push(query); return attempts; }, create: async (query: unknown) => { audits.push(query); return {}; } } };
  return { db: { $transaction: async (fn: (tx: unknown) => unknown) => fn(tx) } as unknown as PrismaClient, audits, updates, queries };
}
test("session revocation supports legacy version zero and rejects stale or malformed versions", () => {
  assert.equal(localSessionCurrent(undefined, 0), true);
  for (const version of [undefined, 0, -1, 1.5, "1", NaN]) assert.equal(localSessionCurrent(version, 1), false);
  assert.equal(localSessionCurrent(1, 1), true);
});
test("anonymous request never reaches the database", async () => {
  assert.ok((await updateOwnAccount({ $transaction: async () => { throw Error("queried"); } } as unknown as PrismaClient, null, passwordInput)).error);
});
test("password and email confirmation and bcrypt byte limit validated before writes", async () => {
  for (const input of [{ ...passwordInput, confirmSignOut: false }, { ...passwordInput, confirmPassword: "mismatch" }, { ...passwordInput, password: "😀".repeat(20), confirmPassword: "😀".repeat(20) }, { ...emailInput, confirmEmail: "other@example.invalid" }]) {
    const f = await fixture(); assert.ok((await updateOwnAccount(f.db, session, input)).error); assert.equal(f.audits.length, 0); assert.equal(f.updates.length, 0);
  }
});
test("wrong password persists attempt but does not update credentials or log password", async () => {
  const f = await fixture(); assert.ok((await updateOwnAccount(f.db, session, { ...passwordInput, currentPassword: "wrong" })).error); assert.equal(f.audits.length, 1); assert.equal(f.updates.length, 0); assert.ok(!JSON.stringify(f.audits).includes("wrong"));
});
test("changed password is hashed and revokes all hostel sessions", async () => {
  const f = await fixture(); assert.equal((await updateOwnAccount(f.db, session, passwordInput)).success, true); assert.equal(await compare(passwordInput.password, f.updates[0].passwordHash as string), true); assert.deepEqual(f.updates[0].sessionVersion, { increment: 1 }); assert.equal(f.audits.length, 2); assert.ok(!JSON.stringify(f.audits).includes("password-123"));
});
test("email normalizes, remains private and does not overwrite public property or platform identity", async () => {
  const f = await fixture(); assert.equal((await updateOwnAccount(f.db, session, emailInput)).success, true); assert.deepEqual(f.updates[0], { email: "new@example.invalid", sessionVersion: { increment: 1 } }); assert.ok(!JSON.stringify(f.audits).includes("new@example.invalid"));
});
test("duplicate emails in the same landlord account are denied", async () => {
  const f = await fixture({}, 0, true); assert.ok((await updateOwnAccount(f.db, session, emailInput)).error); assert.equal(f.updates.length, 0);
});
test("stale session and exhausted attempt budget cannot update credentials", async () => {
  for (const f of [await fixture({ sessionVersion: 1 }), await fixture({}, 5)]) { assert.ok((await updateOwnAccount(f.db, session, passwordInput)).error); assert.equal(f.updates.length, 0); assert.equal(f.audits.length, 0); }
});
test("identity is taken from authenticated user and landlord, never form identifiers", async () => {
  const f = await fixture(); await updateOwnAccount(f.db, session, { ...emailInput, userId: "foreign", organizationId: "two" }); assert.deepEqual((f.queries[0] as { where: unknown }).where, { id: "owner", organizationId: "one", active: true, organization: { status: "ACTIVE" } });
});
const subject = { platformUserId: "central", platformOrganizationId: "central-org", sessionVersion: 2 };
const shared = { ...session, platformSubject: subject };
const linked = { platformUserId: "central", organization: { status: "ACTIVE", platformOrganizationId: "central-org", platformProductCode: "STUDENTSHOSTELS" } };
test("shared-only landlord can set hostel password after confirming current platform password", async () => {
  const f = await fixture({ ...linked, passwordHash: await hash("UNREVEALED-bootstrap-secret", 4) });
  const verify = (async (s, password) => { assert.deepEqual(s, subject); assert.equal(password, "FAKE-platform-password"); return { ...subject, role: "OWNER" } as PlatformIdentity; }) as typeof verifyPlatformPassword;
  assert.equal((await updateOwnAccount(f.db, shared, { ...passwordInput, currentPassword: "FAKE-platform-password" }, verify)).success, true);
});
test("shared confirmation failure, role downgrade and mapping mismatch deny update", async () => {
  for (const [overrides, identity] of [[linked, null], [linked, { ...subject, role: "ADMIN" }], [{ ...linked, platformUserId: "other" }, { ...subject, role: "OWNER" }]] as const) {
    const f = await fixture(overrides); assert.ok((await updateOwnAccount(f.db, shared, passwordInput, (async () => identity) as typeof verifyPlatformPassword)).error); assert.equal(f.updates.length, 0);
  }
});
test("platform password verification uses fixed trusted bridge and rejects stale identity", async () => {
  const old = process.env.HOSTEL_SSO_SECRET; process.env.HOSTEL_SSO_SECRET = "FAKE-proof-secret";
  try {
    const fetcher = (async (url, options) => { assert.equal(url, "https://systeminone.com/api/hostel/sso/credentials"); assert.equal(options?.redirect, "error"); assert.equal(options?.cache, "no-store"); return Response.json({ ...subject, role: "OWNER" }); }) as typeof fetch;
    assert.ok(await verifyPlatformPassword(subject, "FAKE-platform-password", fetcher));
    assert.equal(await verifyPlatformPassword(subject, "password", (async () => Response.json({ ...subject, sessionVersion: 3, role: "OWNER" })) as typeof fetch), null);
    assert.equal(await verifyPlatformPassword(subject, "password", (async () => { throw Error("private"); }) as typeof fetch), null);
  } finally { if (old === undefined) delete process.env.HOSTEL_SSO_SECRET; else process.env.HOSTEL_SSO_SECRET = old; }
});
