import assert from "node:assert/strict";
import { receiptDeliveryQueueState, type ReceiptDeliveryRow } from "../src/lib/receipt-delivery-queue";
import { receiptQueueNavigationRequest } from "../src/lib/receipt-queue-intents";

const base:ReceiptDeliveryRow={
  receiptDeliveryStatus:"PENDING",receiptDeliveryChannel:null,reversedAt:null,
  hasEmail:true,hasPhone:true,
};
assert.deepEqual(receiptDeliveryQueueState(base),{
  queued:true,processing:false,label:"Receipt not sent yet",hint:"Payment recorded. Send the receipt by email or prepare a WhatsApp message.",emailAvailable:true,whatsappAvailable:true,
});
const whatsapp=receiptDeliveryQueueState({...base,receiptDeliveryStatus:"ACTION_REQUIRED",receiptDeliveryChannel:"WHATSAPP",hasEmail:false});
assert.deepEqual(whatsapp,{queued:true,processing:false,label:"WhatsApp send not confirmed",hint:"Check whether you sent the WhatsApp draft before sending it again.",emailAvailable:false,whatsappAvailable:true});
const failed=receiptDeliveryQueueState({...base,receiptDeliveryStatus:"FAILED",receiptDeliveryChannel:"EMAIL"});
assert.equal(failed.label,"Email not sent");
assert.equal(failed.emailAvailable,true);
const noContact=receiptDeliveryQueueState({...base,hasEmail:false,hasPhone:false});
assert.equal(noContact.queued,true);
assert.equal(noContact.label,"Student contact needed");
assert.equal(noContact.emailAvailable,false);
assert.equal(noContact.whatsappAvailable,false);
const emailed=receiptDeliveryQueueState({...base,receiptDeliveryStatus:"SENT",receiptDeliveryChannel:"EMAIL"});
assert.equal(emailed.queued,false);
assert.equal(emailed.emailAvailable,false);
assert.equal(emailed.whatsappAvailable,false);
const reversed=receiptDeliveryQueueState({...base,reversedAt:new Date("2026-10-12T03:48:00Z")});
assert.equal(reversed.queued,false);
assert.equal(reversed.emailAvailable,false);
assert.equal(reversed.whatsappAvailable,false);
const now=new Date("2026-10-12T10:00:00Z");
const processing=receiptDeliveryQueueState({
  ...base,
  receiptDeliveryStatus:"ACTION_REQUIRED",
  receiptDeliveryChannel:"EMAIL",
  receiptDeliveryError:"DELIVERY_PROCESSING",
  updatedAt:new Date("2026-10-12T09:59:20Z"),
},now);
assert.equal(processing.processing,true);
assert.equal(processing.label,"Sending email…");
assert.equal(processing.emailAvailable,false);
assert.equal(processing.whatsappAvailable,false);
const stale=receiptDeliveryQueueState({
  ...base,
  receiptDeliveryStatus:"ACTION_REQUIRED",
  receiptDeliveryChannel:"EMAIL",
  receiptDeliveryError:"DELIVERY_PROCESSING",
  updatedAt:new Date("2026-10-12T09:55:20Z"),
},now);
assert.equal(stale.processing,false);
assert.equal(stale.emailAvailable,true);
assert.equal(receiptQueueNavigationRequest("Show pending receipts"),true);
assert.equal(receiptQueueNavigationRequest("Open receipt delivery queue"),true);
assert.equal(receiptQueueNavigationRequest("Which receipts have not been sent?"),true);
assert.equal(receiptQueueNavigationRequest("Send receipt to the student"),false);
assert.equal(receiptQueueNavigationRequest("Show unpaid students"),false);
console.log("Receipt delivery queue status tests passed");

const whatsappFailure=receiptDeliveryQueueState({...base,receiptDeliveryStatus:"FAILED",receiptDeliveryChannel:"WHATSAPP"});
assert.equal(whatsappFailure.label,"WhatsApp send failed");
assert.equal(whatsapp.queued,true,"Opening a WhatsApp draft must remain unconfirmed");
assert.equal(reversed.label,"Receipt reversed");
assert.equal(emailed.label,"Email sent — delivery unconfirmed");

const missingEmailSetup=receiptDeliveryQueueState({...base,receiptDeliveryStatus:"FAILED",receiptDeliveryChannel:"EMAIL",receiptDeliveryError:"RESEND_API_KEY or RECEIPT_EMAIL_FROM is not configured."});
assert.equal(missingEmailSetup.label,"Receipt email setup needed");
assert.equal(missingEmailSetup.whatsappAvailable,true);
assert.match(missingEmailSetup.hint,/Management needs to complete/);
assert.match(receiptDeliveryQueueState({...base,hasPhone:false}).hint,/Use Send receipt by email/);
assert.match(receiptDeliveryQueueState({...base,hasEmail:false}).hint,/press Send in WhatsApp/);
