import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("sender setup explains each technical field and keeps token entry behind an explicit step", () => {
 const form=readFileSync("src/components/whatsapp-connection-form.tsx","utf8");
 for (const field of ["phoneNumberId","businessAccountId","apiVersion","templateName","templateLanguage","accessToken"]) {
   assert.ok(form.includes(field), field);
 }
 assert.match(form,/WhatsApp → API Setup/);
 assert.match(form,/NOT your mobile number/);
 assert.match(form,/Business Portfolio ID/);
 assert.match(form,/whatsapp_business_messaging/);
 assert.match(form,/whatsapp_business_management/);
 assert.match(form,/coexistence signup/);
 assert.match(form,/<details open=\{Boolean\(state.error\)\}/);
 assert.match(form,/encrypted on save/);
 assert.match(form,/name="enabled" disabled=\{!webhookConfigured\}/);
 assert.match(form,/Verify Meta details and save \(paused by default\)/);
 assert.doesNotMatch(form,/defaultValue=\{[^}]*accessToken/);
});
test("form does not fake sender, callback, opt-in or multi-business readiness",()=>{
 const page=readFileSync("src/app/(app)/communications/whatsapp/page.tsx","utf8");
 const form=readFileSync("src/components/whatsapp-connection-form.tsx","utf8");
 const actions=readFileSync("src/app/(app)/communications/whatsapp/connection-actions.ts","utf8");
 assert.match(page,/\["OWNER","ADMIN"\]\.includes\(session.role\)/);
 assert.match(page,/webhookConfigured=\{Boolean\(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN\)\}/);
 assert.match(page,/centralSharedNumber=\{session.organizationId==="mama-mbugua-hostel"\}/);
 assert.match(form,/cannot by itself prove cross-business routing/);
 assert.match(form,/recipient permissions/);
 assert.match(actions,/residentStaff\(db,session\)/);
 assert.match(actions,/if\(enabled&&!\(process.env.WHATSAPP_APP_SECRET&&process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN\)\)/);
 assert.match(form,/name="accessToken"/);
 assert.doesNotMatch(form,/sendWhatsAppTemplate\(/);
});
