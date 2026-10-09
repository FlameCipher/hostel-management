import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import { requestPasswordRecovery, resetRecoveredPassword, recoveryProperty, usablePasswordRecovery, recoveryTokenHash, recoveryNotice } from "../src/lib/password-recovery";
import { validHostelName, isHostelNameConflict } from "../src/lib/hostel-name";
const config = { apiKey: "fixture", from: "sender@example.invalid", secret: "fixture-long-secret" };
const input = { kind: "MANAGEMENT", identifier: "owner@example.invalid", hostel: "fixture" };
test("recovery rejects untrusted origins before any database or email call", async () => {
  for (const host of [null, "evil.com", "fixture.studentshostels.com.evil.com"]) {
    assert.equal((await requestPasswordRecovery({} as PrismaClient, input, host, config)).message, recoveryNotice);
  }
});
test("missing provider config reports unavailable without querying account existence", async () => {
  assert.match((await requestPasswordRecovery({} as PrismaClient, input, "studentshostels.com", {})).error, /temporarily unavailable/);
});
test("unknown accounts and internal failures share the generic public response", async () => {
  const database = { $queryRaw: async () => { throw Error("PRIVATE_DATABASE_ERROR"); } } as unknown as PrismaClient;
  assert.deepEqual(await requestPasswordRecovery(database, input, "studentshostels.com", config), { error: "", message: recoveryNotice });
});
test("shared forms accept only managed property addresses; custom host cannot switch property", async () => {
  let where: unknown;
  const database = { property: { findFirst: async (q: {where: unknown}) => { where = q.where; return null; } } } as unknown as PrismaClient;
  assert.equal(await recoveryProperty(database, "studentshostels.com", "https://evil.com"), null);
  assert.equal(where, undefined);
  await recoveryProperty(database, "fixture.studentshostels.com", "foreign.studentshostels.com");
  assert.equal((where as unknown as {customDomain: string}).customDomain, "fixture.studentshostels.com");
});
test("invalid tokens and short or mismatched passwords cannot touch the database", async () => {
  assert.equal(await usablePasswordRecovery({} as PrismaClient, "invalid", "fixture.studentshostels.com"), null);
  for (const password of ["short", "🦉".repeat(30)]) assert.ok((await resetRecoveredPassword({} as PrismaClient, { token: "x".repeat(43), password, confirmation: password }, "fixture.studentshostels.com")).error);
  assert.ok((await resetRecoveredPassword({} as PrismaClient, {token:"x".repeat(43),password:"long-password-A",confirmation:"long-password-B"},"fixture.studentshostels.com")).error);
});
test("recovery stores token digests and validates meaningful international hostel names", () => {
  assert.match(recoveryTokenHash("test"), /^[a-f0-9]{64}$/);
  for (const name of ["MMAMBUGUA HOSTEL", "Résidence étudiant", "学生公寓"]) assert.equal(validHostelName(name), true);
  for (const name of [" ", "---", "a", "x".repeat(121)]) assert.equal(validHostelName(name), false);
  assert.equal(isHostelNameConflict(new Error("HOSTEL_NAME_TAKEN")),true);
  assert.equal(isHostelNameConflict({code:"P2002",meta:{target:"Property_hostel_name_unique"}}),true);
  assert.equal(isHostelNameConflict(new Error("offline")),false);
});
