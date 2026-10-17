import assert from "node:assert/strict";
import test from "node:test";
import { compare, hash } from "bcryptjs";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { SessionPayload } from "../src/lib/auth/session";
import { saveHostelStaff } from "../src/lib/hostel-staff";
import { authenticateCaretakerPhone } from "../src/lib/staff-phone-login";
import { normalizeStaffPhone, staffDutyLabel } from "../src/lib/staff-phone-policy";

const session: SessionPayload = { userId: "owner", organizationId: "hostel-a", name: "Owner", role: "OWNER", sessionVersion: 3 };
const input = { name: "Test Gate Operator", email: "", phone: "+254 700 000 001", role: "CARETAKER", active: true, password: "disposable-password-123!", dutyStart: "06:00", dutyEnd: "22:00", dutyTimeZone: "Africa/Nairobi" };
type Row = Record<string, any>;
function fixture(extra: Row[] = [], actor: Row = {}) {
  const rows: Row[] = [{ id: "owner", organizationId: "hostel-a", name: "Owner", email: "owner@example.invalid", role: "OWNER", active: true, sessionVersion: 3, organization: { status: "ACTIVE" }, ...actor }, ...extra];
  const audits: Row[] = []; let writes = 0; const rates = new Map<string, number>();
  const match = (row: Row, where: Row): boolean => Object.entries(where).every(([key, value]) => {
    if (key === "organization") return row.organization?.status === value.status;
    if (value && typeof value === "object") {
      if ("not" in value) return row[key] !== value.not;
      if ("equals" in value) return row[key]?.toLowerCase() === value.equals.toLowerCase();
    }
    return row[key] === value;
  });
  const tx = {
    $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
      if (parts.join("").includes('INSERT INTO "RecoveryRateLimit"')) {
        const key = String(values[0]); const attempts = (rates.get(key) ?? 0) + 1; rates.set(key, attempts); return [{ attempts }];
      }
      return [];
    },
    user: {
      findFirst: async ({ where }: Row) => rows.find(row => match(row, where)) ?? null,
      findMany: async ({ where, take }: Row) => rows.filter(row => match(row, where)).slice(0, take),
      count: async ({ where }: Row) => rows.filter(row => match(row, where)).length,
      create: async ({ data }: Row) => { writes++; const row = { id: "gate-" + writes, sessionVersion: 0, organization: { status: "ACTIVE" }, ...data }; rows.push(row); return row; },
      update: async ({ where, data }: Row) => { writes++; const row = rows.find(row => row.id === where.id)!; const version = row.sessionVersion; Object.assign(row, data); if (data.sessionVersion) row.sessionVersion = version + data.sessionVersion.increment; return row; },
    },
    auditLog: { create: async ({ data }: Row) => { audits.push(data); return data; } },
  };
  const db = { ...tx, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } as unknown as PrismaClient;
  return { db, rows, audits, rates, get writes() { return writes; } };
}

test("creates a real phone-login profile with no invented email and preserves shift hours", async () => {
  const f = fixture();
  const result = await saveHostelStaff(f.db, session, null, input, async () => true);
  assert.equal(result.success, true);
  const saved = f.rows[1];
  assert.equal(saved.email, null); assert.equal(saved.loginPhone, "+254700000001"); assert.equal(saved.phone, "+254700000001");
  assert.equal(saved.role, "CARETAKER"); assert.equal(saved.dutyStart, "06:00"); assert.equal(saved.dutyEnd, "22:00"); assert.equal(saved.dutyTimeZone, "Africa/Nairobi");
  assert.ok(await compare(input.password, saved.passwordHash));
  assert.equal(f.audits[0].actorUserId, "owner"); assert.equal(f.audits[0].metadata.phoneLogin, true);
  assert.ok(!JSON.stringify(f.audits).includes(input.password));
});

test("phone enrollment cannot bypass actor, hostel, role or active-session authorization", async () => {
  for (const actor of [{ role: "CARETAKER" }, { role: "MANAGER" }, { sessionVersion: 4 }, { active: false }, { organizationId: "other" }]) {
    const f = fixture([], actor); const result = await saveHostelStaff(f.db, session, null, input, async () => true);
    assert.equal(result.success, undefined); assert.equal(f.writes, 0);
  }
  const f = fixture(); await saveHostelStaff(f.db, session, null, input, async () => false); assert.equal(f.writes, 0);
});

test("rejects no-email privileged roles, malformed phones and incomplete or invalid duty hours", async () => {
  for (const change of [{ role: "OWNER" }, { role: "ADMIN" }, { role: "MANAGER" }, { phone: "" }, { phone: "0700000001" }, { phone: "+254bad" }, { email: "not-email" }, { dutyEnd: "" }, { dutyStart: "24:00" }, { dutyEnd: "06:00" }, { dutyTimeZone: "not/a-zone" }]) {
    const f = fixture(); const result = await saveHostelStaff(f.db, session, null, { ...input, ...change }, async () => true);
    assert.equal(result.success, undefined, JSON.stringify(change)); assert.equal(f.writes, 0);
  }
});

test("canonical duplicate phones are rejected within a hostel, and scoped across hostels", async () => {
  const existing = { id: "existing", organizationId: "hostel-a", loginPhone: "+254700000001" };
  const duplicate = fixture([existing]);
  assert.equal((await saveHostelStaff(duplicate.db, session, null, input, async () => true)).success, undefined);
  assert.equal(duplicate.writes, 0);
  const other = fixture([{ ...existing, organizationId: "hostel-b" }]);
  assert.equal((await saveHostelStaff(other.db, session, null, input, async () => true)).success, true);
});

test("changing the enrolled phone revokes sessions; editing preserves no-email access and password", async () => {
  const f = fixture(); await saveHostelStaff(f.db, session, null, input, async () => true); const gate = f.rows[1]; const passwordHash = gate.passwordHash;
  assert.equal((await saveHostelStaff(f.db, session, gate.id, { ...input, password: "", phone: "+254700000002" }, async () => true)).success, true);
  assert.equal(gate.sessionVersion, 1); assert.equal(gate.passwordHash, passwordHash); assert.equal(gate.email, null);
  assert.equal((await saveHostelStaff(f.db, session, gate.id, { ...input, phone: "+254700000002", password: "", email: "gate@example.invalid" }, async () => true)).success, true);
  assert.equal(gate.loginPhone, "+254700000002"); assert.equal(gate.sessionVersion, 2);
  assert.equal((await saveHostelStaff(f.db, session, gate.id, { ...input, password: "", email: "gate@example.invalid", role: "MANAGER" }, async () => true)).success, true);
  assert.equal(gate.loginPhone, null); assert.equal(gate.sessionVersion, 3);
});

test("phone login needs the matching password, active caretaker and exact property scope", async () => {
  const passwordHash = await hash(input.password, 4);
  const row = { id: "gate", organizationId: "hostel-a", name: "Gate", role: "CARETAKER", active: true, loginPhone: "+254700000001", passwordHash, sessionVersion: 0, organization: { status: "ACTIVE" } };
  const property = { organizationId: "hostel-a", countryCode: "KE" };
  const credentials = { identifier: "0700000001", password: input.password };
  const f = fixture([row]);
  assert.equal((await authenticateCaretakerPhone(f.db, credentials, property, "test-only-secret"))?.id, "gate");
  assert.equal(await authenticateCaretakerPhone(f.db, { ...credentials, password: "wrong-password" }, property, "test-only-secret"), null);
  assert.equal(await authenticateCaretakerPhone(f.db, credentials, null, "test-only-secret"), null);
  assert.equal(await authenticateCaretakerPhone(f.db, credentials, { ...property, organizationId: "hostel-b" }, "test-only-secret"), null);
  for (const changes of [{ role: "ADMIN" }, { active: false }, { organization: { status: "SUSPENDED" } }, { loginPhone: null }]) {
    assert.equal(await authenticateCaretakerPhone(fixture([{ ...row, ...changes }]).db, credentials, property, "test-only-secret"), null);
  }
});

test("phone sign-in rate limit covers equivalent number formats and stops password work", async () => {
  const f = fixture([{ id: "gate", organizationId: "hostel-a", loginPhone: "+254700000001", role: "CARETAKER", active: true, passwordHash: "stub", organization: { status: "ACTIVE" } }]); const property = { organizationId: "hostel-a", countryCode: "KE" }; let calls = 0;
  for (let i = 0; i < 9; i++) {
    await authenticateCaretakerPhone(f.db, { identifier: i % 2 ? "+254700000001" : "0700000001", password: input.password }, property, "test-only-secret", new Date("2026-10-17T10:00:00Z"), async () => { calls++; return true; });
  }
  assert.equal(f.rates.size, 1); assert.equal([...f.rates.values()][0], 9); assert.equal(calls, 8);
});

test("international normalization and shift labels do not invent 24-hour coverage", () => {
  assert.equal(normalizeStaffPhone("+254 700 000 001"), "+254700000001");
  assert.equal(normalizeStaffPhone("00254700000001"), "+254700000001");
  assert.equal(normalizeStaffPhone("0700000001", "KE"), "+254700000001");
  assert.equal(normalizeStaffPhone("0700000001", "GB"), null);
  assert.equal(staffDutyLabel(input), "6:00 a.m.–10:00 p.m. · Africa/Nairobi");
  assert.equal(staffDutyLabel({}), "Not recorded");
  assert.match(staffDutyLabel({ dutyStart: "22:00", dutyEnd: "06:00", dutyTimeZone: "Africa/Nairobi" }), /overnight/);
});
