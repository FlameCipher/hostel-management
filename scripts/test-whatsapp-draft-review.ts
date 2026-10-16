import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { SessionPayload } from "../src/lib/auth/session";
import { prepareWhatsAppDrafts } from "../src/lib/whatsapp-communications";

const session: SessionPayload = {
  userId: "owner-1", organizationId: "hostel-test", name: "Owner",
  role: "OWNER", sessionVersion: 3,
};
const base = {
  requestId: "c72d3870-673e-4d36-a7c9-31c4374ed40a",
  audience: "TENANTS", selection: "SELECTED",
  recipientIds: ["a", "b"], message: "Test private notice",
  expectedRecipientCount: 2,
};

function fixture(options: {
  students?: string[]; staff?: string[]; missingPhone?: boolean; actorRevoked?: boolean;
} = {}) {
  const students = options.students ?? ["a", "b"];
  const staff = options.staff ?? ["owner-1", "gate-1"];
  const written = new Map<string, unknown>();
  const audits: unknown[] = [];
  const tx = {
    $queryRaw: async () => [],
    user: {
      findFirst: async () => options.actorRevoked ? null : { id: "owner-1", sessionVersion: 3 },
      findMany: async (query: any) => {
        assert.equal(query.where.organizationId, "hostel-test");
        return staff.filter(id => !query.where.id || query.where.id.in.includes(id))
          .map(id => ({ id, name: id, phone: "0712345678" }));
      },
    },
    organization: {
      findUniqueOrThrow: async () => ({ name: "Example Hostel", whatsappEnabled: true }),
    },
    property: {
      findMany: async (query: any) => {
        assert.equal(query.where.organizationId, "hostel-test");
        return [{ id: "property-1", name: "Example Hostel", countryCode: "KE",
          phone: "0712345678", customDomain: null, publicListing: true }];
      },
    },
    student: {
      findMany: async (query: any) => {
        assert.equal(query.where.organizationId, "hostel-test");
        return students.filter(id => !query.where.id || query.where.id.in.includes(id))
          .map(id => ({ id, fullName: "Student " + id,
            phone: options.missingPhone && id === "b" ? "invalid" : "0712345678",
            occupancies: [{ room: { propertyId: "property-1" } }],
          }));
      },
    },
    notification: {
      createMany: async ({ data }: { data: Array<{ id: string }> }) => {
        let count = 0;
        for (const item of data) if (!written.has(item.id)) {
          written.set(item.id, item); count++;
        }
        return { count };
      },
    },
    auditLog: { create: async (record: unknown) => { audits.push(record); return {}; } },
  };
  const db = { $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } as unknown as PrismaClient;
  return { db, written, audits };
}

test("changed tenant review count fails without saving any drafts", async () => {
  const f = fixture();
  const result = await prepareWhatsAppDrafts(f.db, session, { ...base, expectedRecipientCount: 3 });
  assert.match(result.error ?? "", /recipient count changed/i);
  assert.equal(f.written.size, 0);
  assert.equal(f.audits.length, 0);
});

test("changed staff review count also fails closed", async () => {
  const f = fixture();
  const result = await prepareWhatsAppDrafts(f.db, session, {
    ...base, audience: "STAFF", selection: "ALL", recipientIds: [],
    expectedRecipientCount: 1,
  });
  assert.match(result.error ?? "", /recipient count changed/i);
  assert.equal(f.written.size, 0);
});

test("matching reviewed audience creates per-recipient private drafts only", async () => {
  const f = fixture();
  const result = await prepareWhatsAppDrafts(f.db, session, base);
  assert.ok(result.success, result.error);
  assert.equal(f.written.size, 2);
  assert.equal(f.audits.length, 1);
  const entries = [...f.written.values()] as Array<{ organizationId: string; channel: string; recipientType: string; status: string }>;
  assert.ok(entries.every(row => row.organizationId === "hostel-test" && row.channel === "WHATSAPP" &&
    row.recipientType === "STUDENT" && row.status === "QUEUED"));
});

test("same request replay does not duplicate private drafts or audit", async () => {
  const f = fixture();
  assert.ok((await prepareWhatsAppDrafts(f.db, session, base)).success);
  assert.ok((await prepareWhatsAppDrafts(f.db, session, base)).success);
  assert.equal(f.written.size, 2);
  assert.equal(f.audits.length, 1);
});

test("changed selected tenant access never creates partial drafts", async () => {
  const f = fixture({ students: ["a"] });
  const result = await prepareWhatsAppDrafts(f.db, session, base);
  assert.ok(result.error);
  assert.equal(f.written.size, 0);
});

test("invalid phone on one selected recipient prevents entire batch", async () => {
  const f = fixture({ missingPhone: true });
  const result = await prepareWhatsAppDrafts(f.db, session, base);
  assert.match(result.error ?? "", /valid international phone number/);
  assert.equal(f.written.size, 0);
});

test("revoked session and absent management session cannot create drafts", async () => {
  const f = fixture({ actorRevoked: true });
  assert.ok((await prepareWhatsAppDrafts(f.db, session, base)).error);
  assert.ok((await prepareWhatsAppDrafts(f.db, null, base)).error);
  assert.equal(f.written.size, 0);
});

test("mobile composer and server action both require reviewed recipient count", () => {
  const component = readFileSync("src/components/whatsapp-draft-form.tsx", "utf8");
  const actions = readFileSync("src/app/(app)/communications/whatsapp/actions.ts", "utf8");
  const policy = readFileSync("src/lib/whatsapp-communications.ts", "utf8");
  assert.match(component, /name="expectedRecipientCount" value=\{recipientCount\}/);
  assert.match(component, /name="reviewed" checked=\{reviewed\}/);
  assert.match(component, /selected\.map\(id => <input key=\{id\} type="hidden" name="recipientIds"/);
  assert.match(actions, /form\.get\("reviewed"\) !== "on"/);
  assert.match(actions, /Number\.isSafeInteger\(expected\)/);
  assert.match(actions, /expectedRecipientCount: expected/);
  assert.match(policy, /recipients\.length !== value\.expectedRecipientCount/);
});
