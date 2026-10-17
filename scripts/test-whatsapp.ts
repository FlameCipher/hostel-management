import test from "node:test";
import assert from "node:assert/strict";
import { manualDeliveryLabels, propertyTenantLogin, whatsappDraftId, whatsappLink, whatsappNumber } from "../src/lib/whatsapp-policy";
import {whatsappQueueSummary} from "../src/lib/whatsapp-queue-summary";
import {readFileSync} from "node:fs";

test("Kenyan national numbers require Kenyan property context", () => {
  assert.equal(whatsappNumber("0714 464 701", "KE"), "254714464701");
  assert.equal(whatsappNumber("714464701", "KE"), "254714464701");
  assert.equal(whatsappNumber("0714464701", "GB"), null);
  assert.equal(whatsappNumber("0714464701"), null);
});
test("international contacts retain their own country code", () => {
  assert.equal(whatsappNumber("+44 7700 900123", "KE"), "447700900123");
  assert.equal(whatsappNumber("0044 7700 900123"), "447700900123");
  assert.equal(whatsappNumber("+1 (202) 555-0123"), "12025550123");
});
test("invalid and unsafe contact values never produce links", () => {
  for (const phone of ["", "+0000", "tel:0714464701", "+254714464701?text=other", "254714464701ext2", "1".repeat(16)]) assert.equal(whatsappNumber(phone, "KE"), null);
  assert.throws(() => whatsappLink("javascript:alert(1)"));
});
test("message content is encoded without changing the WhatsApp destination", () => {
  const body = "Hello & welcome\nRent + room? #1";
  const url = new URL(whatsappLink("254714464701", body));
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/254714464701");
  assert.equal(url.searchParams.get("text"), body);
});
test("repeated draft preparation is stable and scoped to organization and recipient", () => {
  const key = whatsappDraftId("org", "request", "STUDENT", "one");
  assert.equal(whatsappDraftId("org", "request", "STUDENT", "one"), key);
  for (const args of [["other", "request", "STUDENT", "one"], ["org", "request", "STAFF", "one"], ["org", "request", "STUDENT", "two"]]) assert.notEqual(whatsappDraftId(...args as [string,string,string,string]), key);
});
test("manual status labels do not claim verified delivery", () => {
  assert.match(manualDeliveryLabels.OPENED_FOR_SENDING, /not confirmed/);
  assert.equal(manualDeliveryLabels.SENT, "Marked sent manually");
  assert.equal(manualDeliveryLabels.FAILED, "Needs attention");
});
test("tenant links use the hostel website or shared login, never the old test brand", () => {
  assert.equal(propertyTenantLogin([{customDomain:"mmambugua.studentshostels.com",publicListing:true}]), "https://mmambugua.studentshostels.com/tenant/login");
  assert.equal(propertyTenantLogin([{customDomain:"evil.example",publicListing:true}]), "https://studentshostels.com/tenant/login");
  assert.equal(propertyTenantLogin([{customDomain:"mmambugua.studentshostels.com",publicListing:false}]), "https://studentshostels.com/tenant/login");
});

test("queue aggregates distinguish manual state from verified Meta delivery", () => {
 const q=whatsappQueueSummary([
  {status:"QUEUED",_count:{_all:48}},
  {status:"OPENED_FOR_SENDING",_count:{_all:3}},
  {status:"SENT",_count:{_all:2}},
  {status:"FAILED",_count:{_all:1}},
 ],[
  {status:"ACCEPTED",_count:{_all:2}},
  {status:"DELIVERED",_count:{_all:1}},
  {status:"READ",_count:{_all:1}},
  {status:"REVIEW",_count:{_all:1}},
 ]);
 assert.equal(q.queued,48);
 assert.equal(q.openedUnconfirmed,3);
 assert.equal(q.manualSentUnverified,2);
 assert.equal(q.providerConfirmed,2);
 assert.equal(q.providerAccepted,2);
 assert.equal(q.needsManualAttention,52);
 assert.equal(q.providerReview,1);
 assert.equal(q.manualSentUnverified+q.openedUnconfirmed>q.providerConfirmed,true);
});
test("unknown or negative aggregate counts cannot fabricate delivery",()=>{
 const q=whatsappQueueSummary([{status:"SENT",_count:{_all:-4}}],[
  {status:"SENT",_count:{_all:5}},{status:"READ",_count:{_all:NaN}}
 ]);
 assert.equal(q.manualSentUnverified,0);
 assert.equal(q.providerAccepted,5);
 assert.equal(q.providerConfirmed,0);
});
test("operational page reads complete queue and does not imply automatic sender readiness",()=>{
 const src=readFileSync("src/app/(app)/communications/whatsapp/page.tsx","utf8");
 assert.match(src,/db\.notification\.groupBy/);
 assert.match(src,/db\.whatsAppDelivery\.groupBy/);
 assert.match(src,/queue\.openedUnconfirmed/);
 assert.match(src,/queue\.providerConfirmed/);
 assert.match(src,/automatic=\{diagnostics\.ready\}/);
 assert.doesNotMatch(src,/automatic=\{!!connection\?\.enabled\}/);
});
