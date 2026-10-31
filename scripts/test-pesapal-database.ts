/** Run only against an empty, disposable local PostgreSQL/PGlite database.
 * Apply the schema and new migration first. No live provider calls are made. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { applyVerifiedRentPayment } from "../src/lib/rent-payment-verification";
import { createRentRequest, beginRentCheckout, verifyRentRequest, sendRentRequestEmail } from "../src/lib/rent-payments";
import { recordPayment } from "../src/lib/payment-recording";
import { sealServiceSecret } from "../src/lib/service-security";
import { RENT_ORGANIZATION, type PesapalStatus } from "../src/lib/pesapal-api";
import type { SessionPayload } from "../src/lib/auth/session";

const connectionString = process.env.PESAPAL_TEST_DATABASE_URL;
if (!connectionString || new URL(connectionString).hostname !== "127.0.0.1" || process.env.HOSTEL_PAYMENT_TEST !== "local-fixtures") throw Error("Disposable localhost fixture database required");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) });
const originalFetch = globalThis.fetch;
const originalEnv = { VERCEL_ENV: process.env.VERCEL_ENV, SERVICE_ENCRYPTION_KEY: process.env.SERVICE_ENCRYPTION_KEY };
process.env.VERCEL_ENV = "production";
process.env.SERVICE_ENCRYPTION_KEY = "ab".repeat(32);
// Fail closed if any test accidentally reaches a real service.
globalThis.fetch = async () => { throw Error("External network disabled in payment tests"); };
const owner: SessionPayload = { userId: "fixture-owner", organizationId: RENT_ORGANIZATION, role: "OWNER", name: "Fixture Owner", sessionVersion: 1 };
function provider(id: string, overrides: Partial<PesapalStatus> = {}): PesapalStatus {
  return { status: "200", status_code: 1, payment_status_description: "Completed", merchant_reference: id, amount: 1500, currency: "KES", confirmation_code: "TEST-" + randomUUID(), payment_method: "MPESA", created_date: new Date().toISOString(), ...overrides };
}
let gatewayId = "";
async function charge(studentId = "fixture-student", amount = 3000) {
  return db.charge.create({ data: { organizationId: RENT_ORGANIZATION, studentId, type: "OTHER", description: "Synthetic test rent", amount, currency: "KES", dueDate: new Date(Date.now() + 86_400_000) } });
}
async function pending(chargeId: string, amount = 1500) {
  return db.rentPaymentRequest.create({ data: { id: "R-" + randomUUID(), token: randomUUID(), organizationId: RENT_ORGANIZATION, chargeId, studentId: "fixture-student", gatewayId, amount, currency: "KES", payerName: "Synthetic Payer", payerEmail: "payer@example.com", trackingId: randomUUID(), status: "PENDING", expiresAt: new Date(Date.now() + 86_400_000) } });
}
async function run() {
  assert.equal(await db.organization.count(), 0, "Only an empty fixture database is allowed");
  await db.organization.create({ data: { id: RENT_ORGANIZATION, name: "Synthetic Hostel", ownerName: "Synthetic Owner", phone: "0000000000", receiptPrefix: "TEST" } });
  await db.user.create({ data: { id: owner.userId, organizationId: RENT_ORGANIZATION, name: owner.name, email: "owner@example.com", passwordHash: "not-a-password", role: "OWNER", sessionVersion: 1 } });
  for (const id of ["fixture-student", "fixture-other-student"]) await db.student.create({ data: { id, organizationId: RENT_ORGANIZATION, fullName: "Synthetic " + id, phone: "0000000000", admittedAt: new Date(), portalEnabled: true, portalSessionVersion: 1 } });
  gatewayId = (await db.rentGateway.create({ data: { organizationId: RENT_ORGANIZATION, environment: "LIVE", credentials: sealServiceSecret(JSON.stringify({ consumer_key: "fixture", consumer_secret: "fixture" }), RENT_ORGANIZATION), notificationId: randomUUID() } })).id;
  const c = await charge(), order = await pending(c.id), status = provider(order.id);
  await Promise.all(Array.from({ length: 5 }, () => applyVerifiedRentPayment(db, order.id, order.trackingId!, status)));
  assert.equal(await db.payment.count(), 1, "duplicate notifications must issue one receipt");
  const payment = await db.payment.findFirstOrThrow();
  assert.equal(payment.recordedById, null, "system must not impersonate staff");
  assert.equal(Number(payment.amount), 1500);
  assert.ok(payment.integrityHash && payment.securityReference);
  assert.equal((await db.charge.findUniqueOrThrow({ where: { id: c.id } })).status, "PARTIALLY_PAID");
  assert.equal(await db.auditLog.count({ where: { action: "PESAPAL_PAYMENT_VERIFIED" } }), 1);
  console.log("PASS duplicate callbacks, one integrity-protected receipt, automatic partial balance");

  const wrong = await pending(c.id);
  assert.equal((await applyVerifiedRentPayment(db, wrong.id, wrong.trackingId!, provider(wrong.id, { amount: 1400 }))).status, "REVIEW");
  assert.equal(await db.payment.count(), 1);
  await assert.rejects(applyVerifiedRentPayment(db, wrong.id, randomUUID(), provider(wrong.id)), /TRACKING_MISMATCH/);
  const failed = await pending(c.id);
  assert.equal((await applyVerifiedRentPayment(db, failed.id, failed.trackingId!, provider(failed.id, { status_code: 2, payment_status_description: "FAILED" }))).status, "FAILED");
  assert.equal(await db.payment.count(), 1);
  console.log("PASS wrong amounts, wrong tracking IDs and failed payments never credit balances");

  const duplicate = await pending(c.id);
  assert.equal((await applyVerifiedRentPayment(db, duplicate.id, duplicate.trackingId!, provider(duplicate.id, { confirmation_code: status.confirmation_code }))).status, "REVIEW");
  assert.equal(await db.payment.count(), 1);
  await applyVerifiedRentPayment(db, order.id, order.trackingId!, { ...status, status_code: 3, payment_status_description: "REVERSED" });
  await applyVerifiedRentPayment(db, order.id, order.trackingId!, status);
  assert.ok((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).reversedAt);
  assert.equal((await db.charge.findUniqueOrThrow({ where: { id: c.id } })).status, "UNPAID");
  assert.equal((await db.rentPaymentRequest.findUniqueOrThrow({ where: { id: order.id } })).status, "REVERSED");
  console.log("PASS duplicate references, automatic reversals and late completed notifications");

  const reduced = await charge("fixture-student", 500), creditOrder = await pending(reduced.id);
  await applyVerifiedRentPayment(db, creditOrder.id, creditOrder.trackingId!, provider(creditOrder.id));
  const paid = await db.payment.findMany({ where: { chargeId: reduced.id, reversedAt: null } });
  assert.equal(paid.reduce((sum, p) => sum + Number(p.amount), 0), 1500, "keep the full amount actually received as a visible credit");
  console.log("PASS concurrent charge reduction does not discard money received");

  const manuallyRecorded = await charge();
  const manual = await recordPayment(db, owner, { currency: "KES", chargeId: manuallyRecorded.id, amount: 1500, paidAt: new Date().toISOString().slice(0, 10), method: "MPESA", reference: "MANUAL001" });
  const matched = await pending(manuallyRecorded.id);
  const beforeMatch = await db.payment.count();
  const linked = await applyVerifiedRentPayment(db, matched.id, matched.trackingId!, provider(matched.id, { confirmation_code: "MANUAL001" }));
  assert.equal(linked.paymentId, manual.paymentId);
  assert.equal(await db.payment.count(), beforeMatch);
  await assert.rejects(recordPayment(db, owner, { currency: "KES", chargeId: manuallyRecorded.id, amount: 1500, paidAt: new Date().toISOString().slice(0, 10), method: "CARD", reference: "MANUAL001" }), /DUPLICATE_REFERENCE/);
  console.log("PASS existing manual receipts are linked once; verified references cannot be posted again");

  const otherCharge = await charge("fixture-other-student");
  const input = { id: "R-" + randomUUID(), chargeId: otherCharge.id, amount: 1500, payerName: "Test", payerEmail: "test@example.com" };
  await assert.rejects(createRentRequest(db, { tenant: { studentId: "fixture-student", organizationId: RENT_ORGANIZATION, name: "Test", sessionVersion: 1 } }, input), /CHARGE_NOT_FOUND/);
  await assert.rejects(createRentRequest(db, { staff: { ...owner, sessionVersion: 0 } }, input), /FINANCE_ACCESS_DENIED/);
  await db.user.update({ where: { id: owner.userId }, data: { role: "CARETAKER" } });
  await assert.rejects(createRentRequest(db, { staff: owner }, input), /FINANCE_ACCESS_DENIED/);
  await db.user.update({ where: { id: owner.userId }, data: { role: "OWNER" } });
  const first = await createRentRequest(db, { staff: owner }, input);
  const second = await createRentRequest(db, { staff: owner }, input);
  assert.equal(first.id, second.id); assert.equal(first.token, second.token);
  await assert.rejects(createRentRequest(db, { staff: owner }, { ...input, id: "R-" + randomUUID(), amount: 9000 }), /CHECK_AMOUNT/);
  console.log("PASS tenant isolation, revoked sessions, caretaker denial and request idempotency");

  let emails = 0;
  const oldKey = process.env.RESEND_API_KEY, oldFrom = process.env.RECEIPT_EMAIL_FROM;
  process.env.RESEND_API_KEY = "synthetic"; process.env.RECEIPT_EMAIL_FROM = "test@example.com";
  globalThis.fetch = async (_url, init) => { emails++; assert.equal((init?.headers as Record<string, string>)["Idempotency-Key"], "rent-request-" + first.id); return Response.json({ id: "synthetic" }); };
  await sendRentRequestEmail(db, first.id, RENT_ORGANIZATION);
  await sendRentRequestEmail(db, first.id, RENT_ORGANIZATION);
  assert.equal(emails, 1);
  if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
  if (oldFrom === undefined) delete process.env.RECEIPT_EMAIL_FROM; else process.env.RECEIPT_EMAIL_FROM = oldFrom;
  console.log("PASS repeated request clicks send one email (mock provider; no messages sent)");

  let submissions = 0;
  globalThis.fetch = async url => {
    if (String(url).endsWith("RequestToken")) return Response.json({ status: "200", token: "synthetic" });
    submissions++;
    throw Error("Synthetic network timeout after submission");
  };
  await assert.rejects(beginRentCheckout(db, first.token), /PAYMENT_BEING_CHECKED/);
  await assert.rejects(beginRentCheckout(db, first.token), /PAYMENT_BEING_CHECKED/);
  assert.equal(submissions, 1, "ambiguous checkout responses must not create a second payable order");
  const recoveredTracking = randomUUID();
  globalThis.fetch = async url => Response.json(String(url).endsWith("RequestToken") ? { status: "200", token: "synthetic" } : provider("wrong-merchant-reference"));
  await assert.rejects(verifyRentRequest(db, first.id, recoveredTracking), /REFERENCE_MISMATCH/);
  assert.equal((await db.rentPaymentRequest.findUniqueOrThrow({ where: { id: first.id } })).trackingId, null);
  globalThis.fetch = async url => Response.json(String(url).endsWith("RequestToken") ? { status: "200", token: "synthetic" } : provider(first.id));
  await verifyRentRequest(db, first.id, recoveredTracking);
  assert.equal((await db.rentPaymentRequest.findUniqueOrThrow({ where: { id: first.id } })).status, "COMPLETED");
  console.log("PASS ambiguous submission safety, forged notification rejection and IPN recovery");

  const rollbackCharge = await charge(), rollbackOrder = await pending(rollbackCharge.id);
  await db.$executeRawUnsafe(`CREATE FUNCTION fixture_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'PESAPAL_PAYMENT_VERIFIED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fixture_reject_audit()`);
  await assert.rejects(applyVerifiedRentPayment(db, rollbackOrder.id, rollbackOrder.trackingId!, provider(rollbackOrder.id)));
  assert.equal(await db.payment.count({ where: { chargeId: rollbackCharge.id } }), 0);
  assert.equal((await db.rentPaymentRequest.findUniqueOrThrow({ where: { id: rollbackOrder.id } })).status, "PENDING");
  await db.$executeRawUnsafe('DROP TRIGGER fixture_audit_failure ON "AuditLog"');
  await db.$executeRawUnsafe('DROP FUNCTION fixture_reject_audit()');
  console.log("PASS full transaction rollback when receipt auditing fails");
}
run().finally(async () => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await db.$disconnect();
}).catch(error => { console.error(error); process.exitCode = 1; });
