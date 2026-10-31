import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client";
import { answerHostelQuestion } from "../src/lib/assistant-service";
import { normalizeAssistantQuestion } from "../src/lib/assistant-question";
import { isRoomFinanceFollowup } from "../src/lib/assistant-followup-intents";
import { operationalIntent } from "../src/lib/assistant-operations-read";
import { personSearchIntent, isPersonSearchFollowup } from "../src/lib/assistant-person-intents";
import { issueAssistantContext } from "../src/lib/assistant-conversation-context";

const key = "conversation-regression-test-session-key-2026";
const session = { userId: "owner", organizationId: "hostel-a", name: "Owner", role: "OWNER" as const, sessionVersion: 0 };
const noModel = async () => { assert.fail("Personal record questions must not reach the external model"); };
function fixture(role: "OWNER" | "CARETAKER" = "OWNER") {
  const rooms: string[] = [], ledgerQueries: unknown[] = [];
  const student = { id: "student-a", fullName: "Example Resident", status: "ACTIVE", occupancies: [{ room: { number: "66" }, status: "ACTIVE", semester: { name: "Current" } }] };
  const db = {
    user: { findFirst: async () => ({ id: "owner", role, sessionVersion: 0 }) },
    organization: { findFirst: async () => ({ currency: "KES" }), findUnique: async () => ({ currency: "KES" }) },
    room: { findMany: async ({ where }: any) => {
      assert.equal(where.organizationId, "hostel-a");
      rooms.push(where.number.equals);
      return [{ number: where.number.equals, status: "FULL", property: { name: "Example Hostel" }, occupancies: [{ studentId: student.id, semesterId: "semester-a", status: "ACTIVE", student }] }];
    } },
    student: { findMany: async ({ where }: any) => {
      assert.equal(where.organizationId, "hostel-a");
      return student.fullName.toLowerCase().includes(where.fullName.contains.toLowerCase()) ? [student] : [];
    } },
    charge: { findMany: async ({ where }: any) => {
      assert.equal(role, "OWNER"); assert.equal(where.organizationId, "hostel-a");
      ledgerQueries.push(where);
      assert.ok(where.studentId, "Individual questions must never query all-hostel charges");
      return [{ studentId: student.id, organizationId: "hostel-a", semesterId: "semester-a", currency: "KES", amount: 9000, payments: [] }];
    } },
    payment: { findMany: async ({ where }: any) => {
      assert.equal(role, "OWNER"); assert.equal(where.organizationId, "hostel-a");
      assert.ok(where.studentId, "Individual questions must never query all-hostel payments");
      ledgerQueries.push(where); return [];
    } },
    $transaction: async () => assert.fail("No AI budget or mutation should be needed"),
  } as unknown as PrismaClient;
  return { db, rooms, ledgerQueries };
}
const tokenOf = (reply: Awaited<ReturnType<typeof answerHostelQuestion>>) => "contextToken" in reply && typeof reply.contextToken === "string" ? reply.contextToken : null;

test("everyday room wording preserves the exact room ID", () => {
  for (const question of ["Who's in room no. 66?", "Could you please tell me who is in rm66?", "Show me room #66 occupants", "rom 66", "What about room66?"])
    assert.deepEqual(operationalIntent(question), { kind: "room", number: "66" }, question);
  assert.equal(normalizeAssistantQuestion("Please find Mary O’Neil"), "find Mary O’Neil");
  assert.deepEqual(personSearchIntent("Could you please find Example Resident?"), { kind: "student-search", name: "Example Resident", asksAvailability: false });
  assert.equal(isPersonSearchFollowup("Which room is she in?"), true);
  assert.equal(personSearchIntent("Show me their room"), null);
});

test("finance follow-ups share one conservative client/server parser", () => {
  for (const question of ["How much have they paid this month?", "And what is her balance?", "Could you show me their payments?", "And payments this month?", "Receipts?"])
    assert.equal(isRoomFinanceFollowup(question), true, question);
  for (const question of ["How much have we collected?", "Show me payments for Example Resident", "Room #67 payments", "Send their receipts", "Record payment", "How much has he paid in room 67?"])
    assert.equal(isRoomFinanceFollowup(question), false, question);
});

test("room -> balance -> payments -> room keeps the same signed subject and filters payment dates", async () => {
  const previous = process.env.SESSION_SECRET; process.env.SESSION_SECRET = key;
  try {
    const { db, rooms, ledgerQueries } = fixture();
    let reply = await answerHostelQuestion(db, session, false, "Could you tell me who's in room no. 66?", noModel);
    assert.match(reply.text!, /Example Resident/);
    assert.equal(reply.links![0].href, "/occupancy?q=66");
    const pointer = tokenOf(reply); assert.ok(pointer);
    for (const question of ["How much is the balance?", "How much have they paid this month?", "And payments last month?", "Which room are they in?"]) {
      reply = await answerHostelQuestion(db, session, false, question, noModel, tokenOf(reply));
      assert.equal(reply.mode, "records", question);
      assert.equal(tokenOf(reply), pointer, question);
      assert.match(reply.text!, /Room 66/, question);
    }
    assert.ok(ledgerQueries.some((query: any) => query.paidAt?.gte instanceof Date));
    assert.ok(rooms.every(number => number === "66"));
  } finally { if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous; }
});

test("a named finance answer establishes context for repeated finance and room follow-ups", async () => {
  const previous = process.env.SESSION_SECRET; process.env.SESSION_SECRET = key;
  try {
    const { db } = fixture();
    let reply = await answerHostelQuestion(db, session, false, "What is the balance for Example Resident?", noModel);
    assert.ok(tokenOf(reply));
    for (const question of ["And what is their balance?", "Show me their payments", "Which room are they in?", "Show me their room"]) {
      reply = await answerHostelQuestion(db, session, false, question, noModel, tokenOf(reply));
      assert.equal(reply.mode, "records", question);
      assert.match(reply.text!, /Example Resident/, question);
      assert.ok(tokenOf(reply), question);
    }
    assert.equal(reply.links![0].href, "/occupancy?q=Example%20Resident");
  } finally { if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous; }
});

test("missing, expired or foreign context asks for identity before reading payments", async () => {
  const previous = process.env.SESSION_SECRET; process.env.SESSION_SECRET = key;
  try {
    const { db, ledgerQueries } = fixture();
    for (const pointer of [null, "tampered", issueAssistantContext({ kind: "room", number: "66" }, { ...session, organizationId: "other-hostel" }, key), issueAssistantContext({ kind: "room", number: "66" }, session, key, new Date(Date.now() - 16 * 60 * 1000))]) {
      const reply = await answerHostelQuestion(db, session, false, "How much have they paid?", noModel, pointer);
      assert.equal(reply.mode, "guide"); assert.match(reply.text!, /Which room or student/);
      if (pointer) {
        const balance = await answerHostelQuestion(db, session, false, "How much is the balance?", noModel, pointer);
        assert.equal(balance.mode, "guide"); assert.match(balance.text!, /expired or is no longer valid/);
      }
    }
    assert.equal(ledgerQueries.length, 0);
  } finally { if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous; }
});

test("explicit room changes replace context; multiple rooms request clarification", async () => {
  const previous = process.env.SESSION_SECRET; process.env.SESSION_SECRET = key;
  try {
    const { db, rooms, ledgerQueries } = fixture();
    const old = issueAssistantContext({ kind: "room", number: "66" }, session, key);
    const reply = await answerHostelQuestion(db, session, false, "What about room #67?", noModel, old);
    assert.match(reply.text!, /Room 67/); assert.notEqual(tokenOf(reply), old);
    const followup = await answerHostelQuestion(db, session, false, "Payments?", noModel, tokenOf(reply));
    assert.match(followup.text!, /Room 67/); assert.ok(rooms.every(number => number === "67"));
    const before = ledgerQueries.length;
    for (const question of ["How much have room 66 and room 67 paid?", "Room66 and 67 payments", "Rooms 66 and 67 payments"]) {
      const ambiguous = await answerHostelQuestion(db, session, false, question, noModel, old);
      assert.match(ambiguous.text!, /one room at a time/); assert.equal(ledgerQueries.length, before);
    }
  } finally { if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous; }
});

test("polite unpaid questions read outstanding charges, never the external model", async () => {
  const { db } = fixture();
  let queried = 0;
  (db.charge as any).findMany = async ({ where }: any) => { assert.equal(where.organizationId, "hostel-a"); assert.deepEqual(where.status, { not: "WAIVED" }); queried++; return []; };
  for (const question of ["Could you tell me who hasn't paid?", "Please show students who are yet to pay", "Who owes rent?"]) {
    const reply = await answerHostelQuestion(db, session, false, question, noModel);
    assert.equal(reply.mode, "records", question);
    assert.match(reply.text!, /0 students owe/, question);
  }
  assert.equal(queried, 3);
});

test("a caretaker cannot use a finance follow-up to bypass current role checks", async () => {
  const { db, ledgerQueries } = fixture("CARETAKER");
  const pointer = issueAssistantContext({ kind: "room", number: "66" }, session, key);
  const reply = await answerHostelQuestion(db, session, false, "Could you show me their payments?", noModel, pointer);
  assert.equal(reply.mode, "guide"); assert.match(reply.text!, /private financial records/);
  assert.equal(ledgerQueries.length, 0);
});

test("counting room residents does not query their financial accounts", async () => {
  const { db, ledgerQueries } = fixture();
  const reply = await answerHostelQuestion(db, session, false, "How many residents are in room #66?", noModel);
  assert.equal(reply.mode, "records"); assert.match(reply.text!, /Example Resident/);
  assert.equal(ledgerQueries.length, 0);
});
