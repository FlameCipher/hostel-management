import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import { getTenantProfile } from "../src/lib/student-profile";
import type { TenantSession } from "../src/lib/tenant-session-access";

const session: TenantSession = { studentId: "student-a", organizationId: "hostel-a", name: "Resident", sessionVersion: 2 };
function fixture(enabled = true, version = 2) {
  const reads: Array<{ where: Record<string, unknown>; select: Record<string, unknown> }> = [];
  const database = { student: { findFirst: async (query: typeof reads[number]) => {
    reads.push(query);
    if (!enabled || query.where.id !== "student-a" || query.where.organizationId !== "hostel-a") return null;
    if (query.select.portalSessionVersion) return { id: "student-a", organizationId: "hostel-a", fullName: "Resident", portalSessionVersion: version };
    return { id: "student-a", fullName: "Resident", guardian: { name: "Guardian" } };
  } } } as unknown as Pick<PrismaClient, "student">;
  return { database, reads };
}

test("an enrolled student can view only their own existing record without creating another", async () => {
  const f = fixture();
  assert.equal((await getTenantProfile(f.database, session))?.id, "student-a");
  assert.equal(f.reads.length, 2);
  for (const query of f.reads) {
    assert.equal(query.where.id, "student-a");
    assert.equal(query.where.organizationId, "hostel-a");
    assert.equal(query.where.portalEnabled, true);
  }
  const selection = f.reads[1].select;
  assert.equal(selection.portalPasswordHash, undefined);
  assert.equal(selection.payments, undefined);
});

test("unsigned, revoked, disabled and other-hostel sessions cannot expose a student profile", async () => {
  const unsigned = fixture();
  assert.equal(await getTenantProfile(unsigned.database, null), null);
  assert.equal(unsigned.reads.length, 0);
  for (const f of [fixture(false), fixture(true, 3)]) {
    assert.equal(await getTenantProfile(f.database, session), null);
    assert.equal(f.reads.length, 1);
  }
  assert.equal(await getTenantProfile(fixture().database, { ...session, organizationId: "hostel-b" }), null);
  assert.equal(await getTenantProfile(fixture().database, { ...session, studentId: "student-b" }), null);
});
