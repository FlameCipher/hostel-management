import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import type {PrismaClient} from "../src/generated/prisma/client";
import {createBookingTicket} from "../src/lib/booking-requests";
import {submitTenantRegistration} from "../src/lib/tenant-registration";

test("existing-student registration shows two concise mobile steps, no new room booking",()=>{
 const page=readFileSync("src/app/tenant/register/page.tsx","utf8");
 const form=readFileSync("src/components/tenant-registration-forms.tsx","utf8");
 const styles=readFileSync("src/components/existing-tenant-signup.module.css","utf8");
 assert.match(page,/Existing residents only/);
 assert.match(page,/Requesting access is free and does not book another room/);
 assert.doesNotMatch(page,/(?:href|redirect)\s*=\s*["']\/book/);
 assert.match(form,/1 · My hostel details/);
 assert.match(form,/2 · Set password/);
 for(const name of ["fullName","phone","roomNumber","password","confirmation","consent"])
  assert.ok(form.includes('name="'+name+'"'),name);
 assert.match(form,/reportValidity\(\)/);
 assert.match(form,/getNewPassword|new-password/);
 assert.match(form,/fieldset hidden=\{step!==1\}/);
 assert.match(form,/fieldset hidden=\{step!==2\}/);
 assert.match(styles,/\.fieldset\[hidden\]\{display:none!important\}/);
 assert.match(form,/useActionState\(registerTenantAction/);
 assert.match(form,/Your hostel owner or authorised admin will check your existing hostel record and room/);
 assert.match(form,/does not book another room or charge you rent/);
});
test("owner/admin retains independent identity verification, unique exact match shortcut and no match denial",()=>{
 const form=readFileSync("src/components/tenant-registration-forms.tsx","utf8");
 const actions=readFileSync("src/app/tenant/register/actions.ts","utf8");
 const service=readFileSync("src/lib/tenant-registration.ts","utf8");
 assert.match(form,/defaultValue=\{single\?candidates\[0\]\.id:""\}/);
 assert.match(form,/I independently verified this tenant/);
 // Approval must be disabled for unmatched applicants or blocked/ambiguous review groups.
 assert.match(form,/candidates\.length===0\|\|blockApproval/);
 assert.match(actions,/reviewTenantRegistration/);
 assert.match(service,/portalEnabled: false/);
 assert.match(service,/normalizedResidentName\(student.fullName\) !== normalizedResidentName\(row.fullName\)/);
 assert.match(service,/whatsappNumber\(student.phone, registrationCountryCode\(row.property.countryCode,row.organizationId\)\) !== row.phone/);
 assert.match(service,/input\.verified/);
});
test("even exact existing details only make pending request; no portal is created or activated",async()=>{
 const previous=process.env.SESSION_SECRET;
 process.env.SESSION_SECRET="test-existing-tenant-onboarding-secret-2026-with-entropy";
 const propertyId="hostel-property-one";
 const time=new Date("2026-10-13T10:00:00.000Z");
 const captured:any[]=[];
 let activated=0;
 const property={id:propertyId,organizationId:"hostel-organization",countryCode:"KE",name:"MMAMBUGUA HOSTEL",active:true,publicListing:true};
 const tx={
  $queryRaw:async()=>[],
  property:{findFirst:async()=>({id:propertyId})},
  tenantRegistration:{
   findUnique:async()=>null,
   count:async()=>0,
   create:async({data}:any)=>{captured.push(data);return{id:"new-request"};}
  },
  student:{update:async()=>{activated++;assert.fail("Public registration cannot activate student");}}
 };
 const db={
  property:{findFirst:async()=>property},
  tenantRegistration:{count:async()=>0},
  $transaction:async(fn:(t:unknown)=>unknown)=>fn(tx)
 } as unknown as PrismaClient;
 try{
  const ticket=createBookingTicket("registration:"+propertyId,time);
  const out=await submitTenantRegistration(db,propertyId,{
   fullName:"Example Resident",phone:"0712 345 678",roomNumber:"54",
   password:"a-valid-example-password",confirmation:"a-valid-example-password",consent:true
  },ticket,"test-person-fingerprint",time);
  assert.match(out.success??"",/management verification/);
  assert.equal(captured.length,1);
  assert.equal(activated,0);
  assert.equal(captured[0].phone,"254712345678");
  assert.equal(captured[0].fullName,"Example Resident");
  assert.equal(captured[0].roomNumber,"54");
  assert.notEqual(captured[0].passwordHash,"a-valid-example-password");
  assert.equal(captured[0].status,undefined); // Prisma default PENDING
  assert.equal(captured[0].expiresAt.toISOString(),"2026-10-20T10:00:00.000Z");
 }finally{
  if(previous===undefined)delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET=previous;
 }
});
test("weak password, mismatched password and missing consent are rejected before DB access",async()=>{
 const prev=process.env.SESSION_SECRET;process.env.SESSION_SECRET="test-existing-tenant-onboarding-secret-2026-with-entropy";
 let calls=0;
 const db={property:{findFirst:async()=>{calls++;assert.fail("Invalid request cannot reach DB")}}} as unknown as PrismaClient;
 const time=new Date("2026-10-13T10:00:00Z");
 try{
  const ticket=createBookingTicket("registration:property",time);
  const base={fullName:"Example Resident",phone:"0712 345 678",roomNumber:"54",password:"GoodSecurePassword01",confirmation:"GoodSecurePassword01",consent:true};
  for(const problem of [{password:"short",confirmation:"short"},{confirmation:"different"},{consent:false}]){
   const r=await submitTenantRegistration(db,"property",{...base,...problem},ticket,"fingerprint",time);
   assert.ok(r.error);
  }
  assert.equal(calls,0);
 }finally{
  if(prev===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=prev;
 }
});
