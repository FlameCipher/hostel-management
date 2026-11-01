import assert from "node:assert/strict";
import test from "node:test";
import { PesapalApi, safeCheckoutUrl, validTrackingId, gatewayEnvironmentAllowed, type PesapalStatus } from "../src/lib/pesapal-api";
import { verifiedStatus } from "../src/lib/rent-payment-verification";
import type { RentPaymentRequest } from "../src/generated/prisma/client";

const tracking = "a945e4af-80a5-4ec1-8706-e03f8332fb04";
const order = { id: "R-11111111-1111-4111-8111-111111111111", currency: "KES", amount: 1500 } as unknown as RentPaymentRequest;
const complete: PesapalStatus = { status: "200", status_code: 1, payment_status_description: "Completed", merchant_reference: order.id, amount: 1500, currency: "KES", confirmation_code: "TEST001", payment_method: "MPESA", created_date: "2026-10-31T10:00:00Z" };
test("provider HTTP success is not proof of payment", () => {
  assert.equal(verifiedStatus(order, complete), 1);
  assert.equal(verifiedStatus(order, { ...complete, status_code: 2, payment_status_description: "FAILED" }), 2);
  assert.equal(verifiedStatus(order, { ...complete, status_code: 0, payment_status_description: "INVALID" }), 0);
  assert.throws(() => verifiedStatus(order, { ...complete, status_code: 200 }), /STATUS_MISMATCH/);
  assert.throws(() => verifiedStatus(order, { ...complete, status_code: 0 }), /STATUS_MISMATCH/);
});
test("completed and reversed payments must exactly match the order", () => {
  for (const status of [complete, { ...complete, status_code: 3, payment_status_description: "REVERSED" }]) {
    assert.throws(() => verifiedStatus(order, { ...status, amount: 1499.99 }), /AMOUNT_OR_CURRENCY_MISMATCH/);
    assert.throws(() => verifiedStatus(order, { ...status, currency: "USD" }), /AMOUNT_OR_CURRENCY_MISMATCH/);
    assert.throws(() => verifiedStatus(order, { ...status, merchant_reference: "other-order" }), /REFERENCE_MISMATCH/);
    assert.throws(() => verifiedStatus(order, { ...status, amount: Number.NaN }), /AMOUNT_OR_CURRENCY_MISMATCH/);
  }
  assert.throws(() => verifiedStatus(order, { ...complete, confirmation_code: "" }), /CONFIRMATION_MISSING/);
});
test("checkout URLs and identifiers cannot redirect to attacker origins", () => {
  assert.ok(validTrackingId(tracking));
  assert.ok(safeCheckoutUrl("https://pay.pesapal.com/iframe?OrderTrackingId=" + tracking));
  for (const url of ["https://pay.pesapal.com.attacker.example/", "https://pay.pesapal.com@attacker.example/", "http://pay.pesapal.com/", "javascript:alert(1)", "https://pay.pesapal.com:8443/"]) assert.equal(safeCheckoutUrl(url), false);
  assert.equal(safeCheckoutUrl("https://cybqa.pesapal.com/"), false);
  assert.equal(validTrackingId("anything?other=1"), false);
});
test("preview and local development cannot use live collection", () => {
  const prior = process.env.VERCEL_ENV;
  try {
    for (const value of ["preview", "development", ""]) { process.env.VERCEL_ENV = value; assert.equal(gatewayEnvironmentAllowed("LIVE"), false); }
    process.env.VERCEL_ENV = "production";
    assert.equal(gatewayEnvironmentAllowed("LIVE"), true);
    assert.equal(gatewayEnvironmentAllowed("SANDBOX"), false);
  } finally { if (prior === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = prior; }
});
test("API authenticates server-side, binds amount/reference and obtains verified status", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const transport = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    return Response.json(String(url).endsWith("RequestToken") ? { status: "200", token: "test-bearer" } : String(url).includes("SubmitOrderRequest") ? { status: "200", merchant_reference: order.id, order_tracking_id: tracking, redirect_url: "https://cybqa.pesapal.com/checkout" } : complete);
  };
  const api = new PesapalApi({ consumer_key: "fixture", consumer_secret: "fixture-secret" }, "SANDBOX", transport);
  const result = await api.submit({ id: order.id, amount: 1500, currency: "KES", notificationId: tracking, name: "Test Payer", email: "payer@example.com", phone: null });
  assert.equal(result.trackingId, tracking);
  assert.equal(calls.length, 2);
  const body = JSON.parse(String(calls[1].init.body));
  assert.equal(body.id, order.id); assert.equal(body.amount, 1500); assert.equal(body.currency, "KES");
  assert.equal(body.billing_address.email_address, "payer@example.com");
  assert.equal((calls[1].init.headers as Record<string, string>).Authorization, "Bearer test-bearer");
  assert.equal(await api.status(tracking).then(s => s.status_code), 1);
  assert.match(calls[2].url, /GetTransactionStatus\?orderTrackingId=/);
});
test("untrusted provider redirects and errors never pass through", async () => {
  const transport = async (url: string | URL | Request) => Response.json(String(url).endsWith("RequestToken") ? { status: "200", token: "test" } : { status: "200", merchant_reference: order.id, order_tracking_id: tracking, redirect_url: "https://attacker.example/" });
  await assert.rejects(new PesapalApi({ consumer_key: "test", consumer_secret: "test" }, "SANDBOX", transport).submit({ id: order.id, amount: 1500, currency: "KES", notificationId: tracking, name: "Test", email: "test@example.com", phone: null }), /PESAPAL_INVALID_ORDER/);
});
test("mobile-only checkout sends the payer number without requiring or inventing an email", async () => {
  let billing: Record<string, string> | undefined;
  const transport = async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith("RequestToken")) return Response.json({ status: "200", token: "fixture" });
    billing = JSON.parse(String(init?.body)).billing_address;
    return Response.json({ status: "200", merchant_reference: order.id, order_tracking_id: tracking, redirect_url: "https://cybqa.pesapal.com/checkout" });
  };
  const result = await new PesapalApi({ consumer_key: "fixture", consumer_secret: "fixture" }, "SANDBOX", transport).submit({ id: order.id, amount: 1500, currency: "KES", notificationId: tracking, name: "Test Payer", email: null, phone: "254700000000" });
  assert.equal(billing?.phone_number, "254700000000");
  assert.equal(billing?.email_address, "");
  assert.equal(result.trackingId, tracking);
});
