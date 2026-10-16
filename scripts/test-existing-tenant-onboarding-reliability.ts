import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import type {PrismaClient} from "../src/generated/prisma/client";
import {createBookingTicket} from "../src/lib/booking-requests";
import {registrationCountryCode,submitTenantRegistration} from "../src/lib/tenant-registration";
import {whatsappNumber} from "../src/lib/whatsapp-policy";

const mmambugua="mama-mbugua-hostel";
test("only verified MMAMBUGUA uses Kenyan local phone fallback when countryCode is missing",()=>{
 assert.equal(registrationCountryCode(null,mmambugua),"KE");
 assert.equal(registrationCountryCode("",mmambugua),"KE");
 assert.equal(registrationCountryCode("KE",mmambugua),"KE");
 assert.equal(registrationCountryCode("UG",mmambugua),"UG");
 assert.equal(registrationCountryCode(null,"other-hostel"),null);
 assert.equal(registrationCountryCode("KE","other-hostel"),"KE");
 assert.equal(whatsappNumber("0712 345 678",registrationCountryCode(null,mmambugua)),"254712345678");
 assert.equal(whatsappNumber("0111 222 333",registrationCountryCode(null,mmambugua)),"254111222333");
 assert.equal(whatsappNumber("+254 712345678",registrationCountryCode(null,mmambugua)),"254712345678");
 assert.equal(whatsappNumber("0712 345 678",registrationCountryCode(null,"other-hostel")),null);
});

const now=new Date("2026-10-14T05:30:00.000Z");
function dbFixture(countryCode:string|null,organizationId:string){
 const written:any[]=[];
 let propertyQueries=0;
 const propertyId="property-test";
 const property={id:propertyId,countryCode,organizationId,publicListing:true,active:true};
 const tx={
  $queryRaw:async()=>[],
  property:{findFirst:async()=>({id:propertyId})},
  tenantRegistration:{findUnique:async()=>null,count:async()=>0,create:async({data}:any)=>{written.push(data);return{id:"pending-id"};}},
  student:{update:async()=>assert.fail("Self-registration is not authorized to activate a student")},
 };
 const db={
  property:{findFirst:async()=>{propertyQueries++;return property;}},
  tenantRegistration:{count:async()=>0},
  $transaction:async(fn:(database:unknown)=>unknown)=>fn(tx)
 } as unknown as PrismaClient;
 return {db,propertyId,written,queried:()=>propertyQueries};
}
const raw={fullName:"Example Student",phone:"0712 345 678",roomNumber:"54",
 password:"CorrectLength-2026",confirmation:"CorrectLength-2026",consent:true};

test("MMAMBUGUA without legacy country metadata accepts local phone as pending-only request",async()=>{
 const orig=process.env.SESSION_SECRET;process.env.SESSION_SECRET="test-registered-local-kenyan-phone-secret-2026";
 try{
  const f=dbFixture(null,mmambugua);
  const ticket=createBookingTicket("registration:"+f.propertyId,now);
  const result=await submitTenantRegistration(f.db,f.propertyId,raw,ticket,"opaque-client-fingerprint",now);
  assert.match(result.success??"",/management verification/);
  assert.equal(f.written.length,1);
  assert.equal(f.written[0].phone,"254712345678");
  assert.equal(f.written[0].organizationId,mmambugua);
  assert.notEqual(f.written[0].passwordHash,raw.password);
  assert.equal(f.written[0].status,undefined);
 }finally{if(orig===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=orig;}
});
test("unconfigured foreign hostel cannot guess Kenyan country code from a local-looking number",async()=>{
 const orig=process.env.SESSION_SECRET;process.env.SESSION_SECRET="test-registered-local-kenyan-phone-secret-2026";
 try{
  const f=dbFixture(null,"international-hostel");
  const ticket=createBookingTicket("registration:"+f.propertyId,now);
  const result=await submitTenantRegistration(f.db,f.propertyId,raw,ticket,"opaque-client-fingerprint",now);
  assert.match(result.error??"",/registered phone number with country code/);
  assert.equal(f.written.length,0);
  assert.equal(f.queried(),1);
 }finally{if(orig===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=orig;}
});
test("visible mobile step controls submit and disables hidden password inputs on first step",()=>{
 const form=readFileSync("src/components/tenant-registration-forms.tsx","utf8");
 const page=readFileSync("src/app/tenant/register/page.tsx","utf8");
 assert.match(form,/onSubmit=\{guardSubmit\}/);
 assert.match(form,/if\(step===1\)\{event.preventDefault\(\);next\(\);return;\}/);
 assert.match(form,/fieldset hidden=\{step!==2\} disabled=\{step!==2\}/);
 assert.match(form,/Passwords do not match/);
 assert.match(form,/new TextEncoder\(\)\.encode\(password.value\)\.length>72/);
 assert.match(form,/placeholder=\{localPhone\?/);
 assert.match(form,/Use the same details you gave \{hostelName\}/);
 assert.match(page,/registrationCountryCode\(property.countryCode,property.organizationId\)/);
 assert.match(page,/hostelName=\{property.name\}/);
});
test("registration and approval use the same verified country function",()=>{
 const service=readFileSync("src/lib/tenant-registration.ts","utf8");
 const management=readFileSync("src/app/(app)/students/registrations/page.tsx","utf8");
 assert.match(service,/whatsappNumber\(parsed.data.phone, registrationCountryCode\(property.countryCode,property.organizationId\)\)/);
 assert.match(service,/whatsappNumber\(student.phone, registrationCountryCode\(row.property.countryCode,row.organizationId\)\)/);
 const triage=readFileSync("src/lib/tenant-registration-triage.ts","utf8");
 assert.match(management,/registrationCandidateTriage\(/);
 assert.match(management,/registrationCountryCode\(property\?\.countryCode,session.organizationId\)/);
 assert.match(triage,/whatsappNumber\(student.phone,countryCode\)/);
 assert.match(service,/input.verified/);
 assert.match(service,/portalEnabled: false/);
});
