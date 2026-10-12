import assert from "node:assert/strict";
import {
  normalizeGuardianPhone,
  normalizeStudentLookupName,
} from "../src/lib/student-identifiers";
import { whatsappReadiness } from "../src/lib/whatsapp-diagnostics";

const numbers: Array<[string,string]>=[
  ["0712 345 678","254712345678"],
  ["0712345678","254712345678"],
  ["712345678","254712345678"],
  ["254712345678","254712345678"],
  ["+254 712-345-678","254712345678"],
  ["00254 712 345 678","254712345678"],
  ["0112 345 678","254112345678"],
  ["112345678","254112345678"],
  ["+255 712 345 678","255712345678"],
  ["+44 7700 900123","447700900123"],
];
for(const [input,expected] of numbers){
  assert.equal(normalizeGuardianPhone(input),expected,input);
}
assert.equal(normalizeGuardianPhone("254712345678"),normalizeGuardianPhone("0712345678"));
assert.equal(normalizeStudentLookupName("   JoSEPH    OMESA   Oirere  "),normalizeStudentLookupName("Joseph Omesa Oirere"));
assert.equal(normalizeStudentLookupName("sHEILA    nyaboke"),normalizeStudentLookupName("Sheila Nyaboke"));
assert.notEqual(normalizeStudentLookupName("Joseph Omesa"),normalizeStudentLookupName("Sheila Nyaboke"));

const disconnected=whatsappReadiness({
  enabledForProperty:true,
  senderExists:false,
  senderVerified:false,
  senderEnabled:false,
  webhookConfigured:false,
  eligibleOptIns:0,
});
assert.equal(disconnected.ready,false);
assert.equal(disconnected.senderLabel,"Not connected");
assert.equal(disconnected.webhookLabel,"Setup incomplete");
assert.equal(disconnected.recipientLabel,"No opt-ins yet");
assert.equal(disconnected.blockers.length,3);

const paused=whatsappReadiness({
  enabledForProperty:true,
  senderExists:true,
  senderVerified:true,
  senderEnabled:false,
  webhookConfigured:true,
  eligibleOptIns:18,
});
assert.equal(paused.ready,false);
assert.equal(paused.senderLabel,"Paused");
assert.deepEqual(paused.blockers,["Enable automatic delivery when the sender is ready."]);

const missingConsent=whatsappReadiness({
  enabledForProperty:true,
  senderExists:true,
  senderVerified:true,
  senderEnabled:true,
  webhookConfigured:true,
  eligibleOptIns:0,
});
assert.equal(missingConsent.ready,false);
assert.equal(missingConsent.blockers.length,1);

const enabled=whatsappReadiness({
  enabledForProperty:true,
  senderExists:true,
  senderVerified:true,
  senderEnabled:true,
  webhookConfigured:true,
  eligibleOptIns:6,
});
assert.equal(enabled.ready,true);
assert.deepEqual(enabled.blockers,[]);
assert.deepEqual(enabled.recipientLabel,"6 opted in");

const propertyDisabled=whatsappReadiness({...{
  enabledForProperty:true,senderExists:true,senderVerified:true,
  senderEnabled:true,webhookConfigured:true,eligibleOptIns:6,
},enabledForProperty:false});
assert.equal(propertyDisabled.ready,false);
assert.ok(propertyDisabled.blockers[0].includes("Settings"));

console.log("Guardian phone, case-insensitive name matching and WhatsApp diagnostics tests passed");
