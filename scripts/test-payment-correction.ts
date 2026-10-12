import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { paymentReceiptIntegrityHash } from "../src/lib/payment-receipt-integrity";
import { paymentAmountCorrectionPreview } from "../src/lib/payment-correction-preview";

const preview=paymentAmountCorrectionPreview({
  currency:"KES",chargeAmount:28000,existingActivePaid:14000,
  oldPaymentAmount:9500,replacementAmount:9000,
});
assert.deepEqual(preview,{paidAfter:13500,balanceAfter:14500,change:-500});
const higher=paymentAmountCorrectionPreview({
  currency:"KES",chargeAmount:28000,existingActivePaid:14000,
  oldPaymentAmount:9000,replacementAmount:9500,
});
assert.deepEqual(higher,{paidAfter:14500,balanceAfter:13500,change:500});
assert.throws(()=>paymentAmountCorrectionPreview({
  currency:"KES",chargeAmount:20000,existingActivePaid:19000,
  oldPaymentAmount:4000,replacementAmount:6500,
}),/REPLACEMENT_EXCEEDS_CHARGE/);
assert.throws(()=>paymentAmountCorrectionPreview({
  currency:"KES",chargeAmount:28000,existingActivePaid:14000,
  oldPaymentAmount:9500,replacementAmount:9500,
}),/UNCHANGED_AMOUNT/);
assert.throws(()=>paymentAmountCorrectionPreview({
  currency:"KES",chargeAmount:28000,existingActivePaid:14000,
  oldPaymentAmount:9500,replacementAmount:0,
}),/INVALID_AMOUNT/);
assert.throws(()=>paymentAmountCorrectionPreview({
  currency:"KES",chargeAmount:28000,existingActivePaid:14000,
  oldPaymentAmount:9500,replacementAmount:9000.001,
}),/INVALID_AMOUNT/);
assert.throws(()=>paymentAmountCorrectionPreview({
  currency:"KES",chargeAmount:28000,existingActivePaid:1000,
  oldPaymentAmount:9500,replacementAmount:9000,
}),/INCONSISTENT_LEDGER/);
const issuedAt=new Date("2026-10-12T03:48:01.984Z");
const fixture={
  organizationId:"hostel-1",studentId:"student-1",chargeId:"charge-1",
  receiptNumber:"HTL-2026-00043",securityReference:"SH-ABC123",
  currency:"KES",amount:9000,paidAt:"2026-10-06",
  method:"MPESA",reference:"UJ6HV8P5V0",issuedAt,
};
const expectedPayload=[
  fixture.organizationId,fixture.studentId,fixture.chargeId,
  fixture.receiptNumber,fixture.securityReference,fixture.currency,
  "9000.00",fixture.paidAt,fixture.method,fixture.reference,issuedAt.toISOString(),
].join("|");
assert.equal(paymentReceiptIntegrityHash(fixture),
  createHash("sha256").update(expectedPayload).digest("hex"));
assert.notEqual(paymentReceiptIntegrityHash({...fixture,amount:9500}),paymentReceiptIntegrityHash(fixture));
console.log("Payment correction preview and cryptographic receipt integrity checks passed.");
