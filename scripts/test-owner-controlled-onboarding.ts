import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient, Prisma } from "../src/generated/prisma/client";
import type { SessionPayload } from "../src/lib/auth/session";
import { onboardingAdmin, requireOnboardingAdmin, studentIdentityUpdateError } from "../src/lib/hostel-onboarding-access";
import { invitationManager } from "../src/lib/portal-invitations";
import { visibleStaffNavigation } from "../src/lib/staff-navigation-policy";

const session: SessionPayload = { userId: "owner", organizationId: "hostel-a", role: "OWNER", name: "Owner", sessionVersion: 2 };
const student = { fullName: "Existing Resident", phone: "+254700000001", email: "resident@example.invalid", status: "ACTIVE", admissionNumber: "A1", nationalId: null };
function fixture(role: string, version = 2, eligible = true) {
  const scopes: unknown[] = [];
  const locks: unknown[][] = [];
  const database = {
    student: { findFirst: async ({ where }: { where: { id: string; organizationId: string } }) => where.id === "student-a" && where.organizationId === "hostel-a" ? student : null },
    user: { findFirst: async ({ where }: { where: unknown }) => {
      scopes.push(where);
      return eligible ? { id: "owner", role, sessionVersion: version } : null;
    } },
    $queryRaw: async (_sql: TemplateStringsArray, ...values: unknown[]) => { locks.push(values); return []; },
  } as unknown as Prisma.TransactionClient;
  return { database, scopes, locks };
}

test("only live owner/admin authority can admit students and control invitations", async () => {
  for (const role of ["OWNER", "ADMIN"]) {
    const f = fixture(role);
    assert.ok(await onboardingAdmin(f.database, session));
    assert.ok(await invitationManager(f.database as PrismaClient, session));
    assert.deepEqual(f.scopes[0], {
      id: "owner", organizationId: "hostel-a", active: true,
      organization: { status: "ACTIVE" }, role: { in: ["OWNER", "ADMIN"] },
    });
  }
  for (const role of ["MANAGER", "CARETAKER", "STUDENT", "UNKNOWN"]) {
    const f = fixture(role);
    assert.equal(await onboardingAdmin(f.database, session), null);
    assert.equal(await invitationManager(f.database as PrismaClient, session), null);
    await assert.rejects(requireOnboardingAdmin(f.database, session), /owner or authorised admin/);
  }
});

test("manager cannot repurpose an enrolled student or alter login contacts and access status", async () => {
  const f = fixture("MANAGER");
  for (const change of [{fullName:"Another Resident"},{email:"other@example.invalid"},{phone:"+254700000002"},{status:"ACTIVE",admissionNumber:"A2"},{status:"ARCHIVED"}]) {
    assert.match(await studentIdentityUpdateError(f.database, session, "student-a", {...student,...change}) ?? "", /owner or an authorised admin/);
  }
  assert.equal(await studentIdentityUpdateError(f.database, session, "student-a", {...student,email:" Resident@Example.Invalid "}), null);
  assert.match(await studentIdentityUpdateError(f.database, session, "other-student", student) ?? "", /could not be found/);
  for (const role of ["OWNER", "ADMIN"]) {
    assert.equal(await studentIdentityUpdateError(fixture(role).database, session, "student-a", {...student,email:"approved@example.invalid"}), null);
  }
  assert.ok(await studentIdentityUpdateError(fixture("MANAGER",3).database, session, "student-a", student));
});

test("revocation, missing membership and missing session fail closed", async () => {
  const revoked = fixture("OWNER", 3);
  assert.equal(await onboardingAdmin(revoked.database, session), null);
  assert.equal(await invitationManager(revoked.database as PrismaClient, session), null);
  const missing = fixture("OWNER", 2, false);
  assert.equal(await onboardingAdmin(missing.database, session), null);
  assert.equal(await onboardingAdmin(missing.database, null), null);
  await assert.rejects(requireOnboardingAdmin(missing.database, session));
});

test("onboarding locks current hostel and actor, and managers have no approval entry point", async () => {
  const f = fixture("ADMIN");
  await requireOnboardingAdmin(f.database, session);
  assert.deepEqual(f.locks, [["hostel-a"], ["owner", "hostel-a"]]);
  for (const role of ["MANAGER", "CARETAKER"] as const)
    assert.ok(!visibleStaffNavigation(role).some(link => link.href === "/students/registrations"));
  for (const role of ["OWNER", "ADMIN"] as const)
    assert.ok(visibleStaffNavigation(role).some(link => link.href === "/students/registrations"));
});
