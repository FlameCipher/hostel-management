import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {
 MMAMBUGUA_EMERGENCY_ORGANIZATION_ID,MMAMBUGUA_EMERGENCY_PHONES,
 KENYA_EMERGENCY_PHONES,hostelEmergencyPhones,
} from "../src/lib/hostel-emergency-contacts";
import {HostelEmergencyCallLinks} from "../src/components/hostel-emergency-call-links";

test("the two owner-supplied MMAMBUGUA numbers are correct one-tap Kenyan dial targets",()=>{
 assert.equal(MMAMBUGUA_EMERGENCY_ORGANIZATION_ID,"mama-mbugua-hostel");
 assert.deepEqual(MMAMBUGUA_EMERGENCY_PHONES.map(x=>x.display),["0714 464 701","0722 634 013"]);
 assert.deepEqual(MMAMBUGUA_EMERGENCY_PHONES.map(x=>x.href),["tel:+254714464701","tel:+254722634013"]);
 assert.equal(new Set(MMAMBUGUA_EMERGENCY_PHONES.map(x=>x.href)).size,2);
 assert.deepEqual(KENYA_EMERGENCY_PHONES.map(x=>x.href),["tel:999","tel:112"]);
});
test("MMAMBUGUA contacts cannot silently appear for another landlord's students or on shared directory",()=>{
 assert.equal(hostelEmergencyPhones("other-hostel").length,0);
 assert.equal(hostelEmergencyPhones(null).length,0);
 assert.equal(hostelEmergencyPhones(undefined).length,0);
 assert.equal(hostelEmergencyPhones("mama-mbugua-hostel").length,2);
 const other=renderToStaticMarkup(createElement(HostelEmergencyCallLinks,{organizationId:"other-hostel"}));
 const shared=renderToStaticMarkup(createElement(HostelEmergencyCallLinks,{organizationId:null}));
 assert.equal(other,"");assert.equal(shared,"");
});
test("both click-to-call buttons are visible without login, GPS, permissions or sending SOS",()=>{
 const rendered=renderToStaticMarkup(createElement(HostelEmergencyCallLinks,{organizationId:MMAMBUGUA_EMERGENCY_ORGANIZATION_ID}));
 for(const phone of MMAMBUGUA_EMERGENCY_PHONES){
  assert.ok(rendered.includes('href="'+phone.href+'"'),phone.href);
  assert.ok(rendered.includes(phone.display),phone.display);
 }
 for(const emergency of KENYA_EMERGENCY_PHONES){
  assert.ok(rendered.includes('href="'+emergency.href+'"'));
 }
 assert.match(rendered,/phone dialer/i);
 assert.match(rendered,/not automatically placed or answered/i);
 assert.match(rendered,/not a guaranteed emergency dispatch service/i);
 assert.doesNotMatch(rendered,/(?:onClick|geolocation|fetch\(|navigator|automatic police dispatch)/i);
});
test("staff and student safety/outings, portal, public login and help all show verified contacts",()=>{
 const paths=[
  "src/app/tenant/login/page.tsx",
  "src/app/tenant/account/page.tsx",
  "src/app/tenant/safety/page.tsx",
  "src/app/tenant/movements/page.tsx",
  "src/app/(app)/safety/page.tsx",
  "src/app/(app)/outings/page.tsx",
  "src/app/(app)/gate-readiness/page.tsx",
  "src/app/help/page.tsx"
 ];
 for(const path of paths){
  const source=readFileSync(path,"utf8");
  assert.match(source,/HostelEmergencyCallLinks/,path);
  assert.match(source,/organizationId=\{(?:context\.property\?\.organizationId|organizationId|session\.organizationId)\}/,path);
 }
 const login=readFileSync(paths[0],"utf8");
 const help=readFileSync(paths.at(-1)!,"utf8");
 assert.match(login,/context\.property\?\.organizationId/);
 assert.match(help,/requestPropertyContext\(\)/);
 assert.match(help,/context\.property\?\.organizationId/);
});
test("implementation is contact-only and does not enable SOS, track residents or create charges",()=>{
 const ui=readFileSync("src/components/hostel-emergency-call-links.tsx","utf8");
 const policy=readFileSync("src/lib/hostel-emergency-contacts.ts","utf8");
 assert.doesNotMatch(ui+policy,/HOSTEL_SOS_ENABLED\s*=|studentOuting\.(?:create|update)|student\.update|payment\.create|watchPosition/);
 assert.doesNotMatch(ui+policy,/responder on duty|guaranteed answer|24\/7 staffed/i);
});
