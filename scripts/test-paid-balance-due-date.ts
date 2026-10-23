import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaymentBalanceDueDate } from "../src/components/payment-balance-due-date";
import { paymentEntryBalance } from "../src/lib/payment-entry-balance";
import { recordPayment } from "../src/lib/payment-recording";
import type { PrismaClient } from "../src/generated/prisma/client";

test("partial payments show a date input; cleared balances never submit a next date", () => {
  for (const [amount, hasDate] of [["4500", true], ["18000", false], ["", false], ["0", false], ["19000", false]] as const) {
    const html = renderToStaticMarkup(createElement(PaymentBalanceDueDate, { balance: 18000, amount, currency: "KES" }));
    assert.equal(html.includes('name="nextBalanceDueDate"'), hasDate, amount);
    if (amount === "18000") assert.match(html, /clears the selected balance/);
  }
  assert.equal(paymentEntryBalance(0.3, "0.3", "USD"), 0);
  assert.equal(paymentEntryBalance(1, "0.333", "USD"), null);
  assert.equal(paymentEntryBalance(undefined, "100", "KES"), null);
});

test("ledger ignores a stale next date when payment clears the balance and retains it for partial payment", async () => {
  const originalDate = new Date("2026-10-10T12:00:00Z");
  for (const amount of [18000, 4500]) {
    let saved: { status: string; dueDate: Date } | undefined;
    const tx = {
      $queryRaw: async () => [],
      user: { findFirst: async () => ({ id: "owner" }) },
      charge: {
        findFirst: async () => ({ id: "charge", studentId: "resident", amount: 18000, currency: "KES", payments: [], dueDate: originalDate, type: "OTHER", occupancyId: null, semester: null }),
        update: async ({ data }: { data: typeof saved }) => { saved = data; },
      },
      organization: { findUnique: async () => ({ receiptPrefix: "TEST" }) },
      receiptSequence: { upsert: async () => ({ lastIssued: 1 }) },
      payment: { create: async () => ({ id: "test-payment" }) },
      auditLog: { create: async () => ({}) },
    };
    const database = { $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) } as unknown as PrismaClient;
    await recordPayment(database, { userId: "owner", organizationId: "hostel", role: "OWNER", name: "Owner", sessionVersion: 1 }, {
      currency: "KES", chargeId: "charge", amount, paidAt: "2026-10-23", method: "CASH", nextBalanceDueDate: "2099-01-10",
    });
    assert.equal(saved?.status, amount === 18000 ? "FULLY_PAID" : "PARTIALLY_PAID");
    assert.equal(saved?.dueDate.toISOString(), amount === 18000 ? originalDate.toISOString() : "2099-01-10T12:00:00.000Z");
  }
});
