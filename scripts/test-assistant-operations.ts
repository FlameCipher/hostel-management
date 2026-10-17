import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client";
import { operationalIntent,answerOperationalQuestion } from "../src/lib/assistant-operations-read";
import { managementIntent } from "../src/lib/assistant-management-intents";

test("natural-language action phrases open guarded workflows without any write",()=>{
  for (const q of ["Register a student","Register a new student","Create new student","Add this student"]) assert.deepEqual(managementIntent(q),{kind:"register"});
  for(const q of ["Record payment","Add payment KES 9,000","Record a new payment","Post this payment"])assert.deepEqual(managementIntent(q),{kind:"payment"});
  assert.equal(managementIntent("Please delete all students"),null);
  assert.equal(managementIntent("Show me the private password"),null);
});
test("room, visitor, caretaker and pending queues classify safely",()=>{
  assert.deepEqual(operationalIntent("Who is in room 54?"),{kind:"room",number:"54"});
  assert.deepEqual(operationalIntent("Room 25A occupants"),{kind:"room",number:"25A"});
  assert.deepEqual(operationalIntent("Who has not checked out?"),{kind:"overdue-visitors"});
  assert.deepEqual(operationalIntent("How many visitors are expected?"),{kind:"visitor-count"});
  assert.deepEqual(operationalIntent("How many pending registrations?"),{kind:"registrations"});
  assert.deepEqual(operationalIntent("Show receipts pending delivery"),{kind:"receipt-queue"});
  assert.deepEqual(operationalIntent("How many active caretaker accounts?"),{kind:"gate-staff"});
  assert.deepEqual(operationalIntent("How many WhatsApp messages are pending?"),{kind:"whatsapp-queue"});
  assert.deepEqual(operationalIntent("Show Whatsapp delivery status"),{kind:"whatsapp-queue"});
  assert.equal(operationalIntent("Turn off visitor security"),null);
});
test("tenant scoping and no mutation in room lookup",async()=>{
 const db={room:{findMany:async (q:any)=>{
   assert.equal(q.where.organizationId,"one-hostel");
   assert.equal(q.where.number.equals,"54");
   return [{number:"54",property:{name:"MMAMBUGUA HOSTEL"},status:"FULL",occupancies:[{student:{fullName:"Example Resident"},status:"ACTIVE"}]}];
 }}} as unknown as PrismaClient;
 const r=await answerOperationalQuestion(db,"one-hostel","CARETAKER",{kind:"room",number:"54"});
 assert.match(r.text,/Example Resident/);assert.match(r.text,/not independent proof/);assert.equal(r.mode,"records");
});
test("ambiguous room across properties does not choose a resident",async()=>{
 const rows=[{number:"54"},{number:"54"}];const db={room:{findMany:async()=>rows}} as unknown as PrismaClient;
 const r=await answerOperationalQuestion(db,"one-hostel","MANAGER",{kind:"room",number:"54"});
 assert.match(r.text,/Multiple properties/);
});
test("overdue visitors label missing departure, not physical presence",async()=>{
 const db={visitorRequest:{count:async()=>1,findMany:async (q:any)=>{assert.equal(q.where.organizationId,"hostel");return [{visitorName:"Guest A",roomLabel:"Room 10",expectedDeparture:new Date("2026-10-12T12:00:00Z")}]}}} as unknown as PrismaClient;
 const r=await answerOperationalQuestion(db,"hostel","CARETAKER",{kind:"overdue-visitors"},new Date("2026-10-12T15:00:00Z"));
 assert.match(r.text,/Guest A/);assert.match(r.text,/does NOT confirm/);assert.equal(r.links[0].href,"/visitors?filter=OVERDUE");
});
test("caretaker cannot query receipts or tenant registration",async()=>{
 const db={payment:{count:async()=>{assert.fail("Finance query must never run");}},tenantRegistration:{count:async()=>{assert.fail("Registration query must never run");}}} as unknown as PrismaClient;
 for(const kind of ["receipt-queue","registrations"] as const){
  const r=await answerOperationalQuestion(db,"hostel","CARETAKER",{kind});
  assert.match(r.text,/Only authorized management/);
 }
});
test("finance receipt queue uses only valid unreversed tenant-scoped records",async()=>{
 const db={payment:{count:async ({where}:any)=>{
  assert.equal(where.organizationId,"hostel");
  assert.equal(where.reversedAt,null);
  assert.deepEqual(where.receiptDeliveryStatus.in,["PENDING","FAILED","ACTION_REQUIRED"]);
  return 3;
 }}} as unknown as PrismaClient;
 const r=await answerOperationalQuestion(db,"hostel","MANAGER",{kind:"receipt-queue"});
 assert.match(r.text,/3 unreversed payment receipts/);assert.match(r.text,/Nothing has been resent/);
});

test("WhatsApp queue answers use current hostel scope and no sending",async()=>{
 const queries:unknown[]=[];
 const db={
  notification:{count:async({where}:any)=>{queries.push(where);
   assert.equal(where.organizationId,"hostel");
   assert.equal(where.channel,"WHATSAPP");
   return ({QUEUED:48,OPENED_FOR_SENDING:3,SENT:1,FAILED:2} as Record<string,number>)[where.status]??0;}},
  whatsAppDelivery:{count:async({where}:any)=>{queries.push(where);
   assert.equal(where.organizationId,"hostel");
   assert.deepEqual(where.status.in,["DELIVERED","READ"]);
   return 0;}}
 } as unknown as PrismaClient;
 const r=await answerOperationalQuestion(db,"hostel","OWNER",{kind:"whatsapp-queue"});
 assert.match(r.text,/48 WhatsApp drafts are queued/);
 assert.match(r.text,/3 were opened but are not confirmed sent/);
 assert.match(r.text,/0 provider delivery\/read receipts/);
 assert.match(r.text,/No messages were sent or retried/);
 assert.equal(queries.length,5);
 assert.equal(r.links[0].href,"/communications/whatsapp");
});
test("caretaker cannot use the AI to inspect management WhatsApp queues",async()=>{
 const db={notification:{count:async()=>assert.fail("Must not query WhatsApp messages")}} as unknown as PrismaClient;
 const r=await answerOperationalQuestion(db,"hostel","CARETAKER",{kind:"whatsapp-queue"});
 assert.match(r.text,/Only authorized management/);
});
