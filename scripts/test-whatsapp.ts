import test from "node:test";
import assert from "node:assert/strict";
import { manualDeliveryLabels, propertyTenantLogin, whatsappDraftId, whatsappLink, whatsappNumber } from "../src/lib/whatsapp-policy";

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
