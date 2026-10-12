import assert from "node:assert/strict";
import { receiptDeliveryQueueState, type ReceiptDeliveryRow } from "../src/lib/receipt-delivery-queue";

const base:ReceiptDeliveryRow={
  receiptDeliveryStatus:"PENDING",receiptDeliveryChannel:null,reversedAt:null,
  hasEmail:true,hasPhone:true,
};
assert.deepEqual(receiptDeliveryQueueState(base),{
  queued:true,label:"Not yet delivered",emailAvailable:true,whatsappAvailable:true,
});
const whatsapp=receiptDeliveryQueueState({...base,receiptDeliveryStatus:"ACTION_REQUIRED",receiptDeliveryChannel:"WHATSAPP",hasEmail:false});
assert.deepEqual(whatsapp,{queued:true,label:"WhatsApp sharing required",emailAvailable:false,whatsappAvailable:true});
const failed=receiptDeliveryQueueState({...base,receiptDeliveryStatus:"FAILED",receiptDeliveryChannel:"EMAIL"});
assert.equal(failed.label,"Email delivery failed");
assert.equal(failed.emailAvailable,true);
const noContact=receiptDeliveryQueueState({...base,hasEmail:false,hasPhone:false});
assert.equal(noContact.queued,true);
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
console.log("Receipt delivery queue status tests passed");
