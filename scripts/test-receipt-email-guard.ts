import assert from "node:assert/strict";
import {
  RECEIPT_EMAIL_PROCESSING, receiptEmailClaimWhere, activeReceiptEmailClaimWhere,
} from "../src/lib/receipt-delivery-guard";

const expiredAt=new Date("2026-10-12T10:00:00Z");
const where=receiptEmailClaimWhere("payment-one","hostel-one",expiredAt);
assert.equal(where.id,"payment-one");
assert.equal(where.organizationId,"hostel-one");
assert.equal(where.reversedAt,null);
assert.ok(Array.isArray(where.OR));
const conditions=JSON.stringify(where.OR);
assert.ok(conditions.includes('"PENDING"'));
assert.ok(conditions.includes('"FAILED"'));
assert.ok(conditions.includes('"ACTION_REQUIRED"'));
assert.ok(conditions.includes("DELIVERY_PROCESSING"));
assert.ok(!conditions.includes('"SENT"'));
const claimed=activeReceiptEmailClaimWhere("payment-one","hostel-one");
assert.equal(claimed.id,"payment-one");
assert.equal(claimed.receiptDeliveryStatus,"ACTION_REQUIRED");
assert.equal(claimed.receiptDeliveryChannel,"EMAIL");
assert.equal(claimed.receiptDeliveryError,RECEIPT_EMAIL_PROCESSING);
assert.equal(claimed.reversedAt,null);
console.log("Receipt email delivery claim and retry guard tests passed");
