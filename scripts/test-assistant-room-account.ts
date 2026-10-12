import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import { roomAccountIntent,answerRoomAccount } from "../src/lib/assistant-room-account";
import { managementIntent } from "../src/lib/assistant-management-intents";
import { occupancySearchShortcut } from "../src/lib/assistant-search-policy";

const actor={organizationId:"hostel-a",role:"OWNER" as const};
const resident=(id:string,name:string,status:"ACTIVE"|"RESERVED"="ACTIVE")=>({
 studentId:id,semesterId:"semester-current",status,student:{fullName:name}
});
const room=(occupancies:ReturnType<typeof resident>[],name="MMAMBUGUA HOSTEL")=>({
 number:"41",property:{name},occupancies
});
function buildFake(overrides:{
 rooms?:unknown[]; charges?:unknown[]; payments?:unknown[]; currency?:string;
 forbidFinancialQueries?:boolean;
}={}){
 const counts={room:0,charge:0,payment:0};
 const db={
  organization:{findFirst:async ({where}:any)=>{assert.equal(where.id,"hostel-a");return{currency:overrides.currency??"KES"};}},
  room:{findMany:async ({where}:any)=>{counts.room++;assert.equal(where.organizationId,"hostel-a");assert.equal(where.property.organizationId,"hostel-a");assert.equal(where.number.equals,"41");return overrides.rooms??[room([resident("resident-1","Example Resident")])];}},
  charge:{findMany:async ({where}:any)=>{if(overrides.forbidFinancialQueries)assert.fail("financial charge query should not run");counts.charge++;assert.equal(where.organizationId,"hostel-a");return overrides.charges??[];}},
  payment:{findMany:async ({where}:any)=>{if(overrides.forbidFinancialQueries)assert.fail("financial payment query should not run");counts.payment++;assert.equal(where.organizationId,"hostel-a");assert.equal(where.reversedAt,null);return overrides.payments??[];}}
 };
 return{db:db as unknown as PrismaClient,counts};
}
test("matches room-specific finance ahead of hostel-wide collections, including the screenshot's wording",()=>{
 for(const input of [
  "Who is in room 41 how much did he pay",
  "Show room 41 payments",
  "How much has Room 41 paid?",
  "What is the outstanding balance of room 41?",
 ])assert.deepEqual(roomAccountIntent(input),{number:"41"},input);
 assert.equal(roomAccountIntent("How much have we collected this month?"),null);
 assert.equal(roomAccountIntent("Who is in room 41?"),null);
 assert.deepEqual(managementIntent("Who is in room 41 how much did he pay"),{kind:"collected",month:null});
 assert.equal(occupancySearchShortcut("Show room 41 how much did he pay"),null);
});
test("responds with one resident's current-semester and all-period amounts, never all hostel payments",async()=>{
 const charges=[
  {studentId:"resident-1",semesterId:"semester-current",currency:"KES",amount:18000,
   payments:[{studentId:"resident-1",organizationId:"hostel-a",currency:"KES",amount:4500},
             {studentId:"resident-1",organizationId:"hostel-a",currency:"KES",amount:9000}]},
  {studentId:"resident-1",semesterId:"semester-previous",currency:"KES",amount:14000,
   payments:[{studentId:"resident-1",organizationId:"hostel-a",currency:"KES",amount:3000}]}
 ];
 const payments=[4500,9000,3000].map(amount=>({
  studentId:"resident-1",organizationId:"hostel-a",currency:"KES",amount,
  charge:{organizationId:"hostel-a",studentId:"resident-1"}
 }));
 const {db,counts}=buildFake({charges,payments});
 const result=await answerRoomAccount(db,actor,"41");
 assert.equal(result.mode,"records");
 assert.match(result.text,/Room 41 — MMAMBUGUA HOSTEL/);
 assert.match(result.text,/Example Resident/);
 assert.match(result.text,/Current semester charges: KES 18,000.00/);
 assert.match(result.text,/Paid toward current semester: KES 13,500.00/);
 assert.match(result.text,/Current semester outstanding: KES 4,500.00/);
 assert.match(result.text,/All recorded unreversed payments \(all periods\): KES 16,500.00/);
 assert.doesNotMatch(result.text,/353,500/);
 assert.equal(counts.charge,1);assert.equal(counts.payment,1);
 assert.match(result.links[0].href,/^\/payments\?q=/);
});
test("shared rooms show both residents separately and never assume the singular pronoun identifies one person",async()=>{
 const occupants=[resident("a","Student A"),resident("b","Student B")];
 const charges=[
  {studentId:"a",semesterId:"semester-current",currency:"KES",amount:14000,payments:[{studentId:"a",organizationId:"hostel-a",currency:"KES",amount:14000}]},
  {studentId:"b",semesterId:"semester-current",currency:"KES",amount:14000,payments:[]}
 ];
 const payments=[{studentId:"a",organizationId:"hostel-a",currency:"KES",amount:14000,charge:{studentId:"a",organizationId:"hostel-a"}}];
 const {db}=buildFake({rooms:[room(occupants)],charges,payments});
 const result=await answerRoomAccount(db,actor,"41");
 assert.match(result.text,/Student A/);
 assert.match(result.text,/Student B/);
 assert.match(result.text,/Current semester outstanding: KES 0.00/);
 assert.match(result.text,/Current semester outstanding: KES 14,000.00/);
 assert.equal(result.links[0].href,"/payments");
});
test("no room or ambiguous property room fails closed before ledger query",async()=>{
 for(const rooms of [[],[room([]),room([])]]) {
  const {db,counts}=buildFake({rooms,forbidFinancialQueries:true});
  const response=await answerRoomAccount(db,actor,"41");
  assert.ok(!response.text.includes("KES"));
  assert.equal(counts.charge,0);
 }
});
test("a room with no current student cannot have money attributed to it",async()=>{
 const {db,counts}=buildFake({rooms:[room([])],forbidFinancialQueries:true});
 const response=await answerRoomAccount(db,actor,"41");
 assert.match(response.text,/No active or reserved student occupancy/);
 assert.equal(counts.payment,0);
});
test("caretaker cannot read any student payments",async()=>{
 const {db,counts}=buildFake({forbidFinancialQueries:true});
 const response=await answerRoomAccount(db,{organizationId:"hostel-a",role:"CARETAKER"},"41");
 assert.match(response.text,/requires management finance access/);
 assert.equal(counts.room,0);
});
test("incorrect payment identity or foreign currency stops figures",async()=>{
 const {db}=buildFake({charges:[{studentId:"resident-1",semesterId:"semester-current",currency:"KES",amount:18000,
  payments:[{studentId:"foreign",organizationId:"hostel-a",currency:"KES",amount:9000}]}]});
 const response=await answerRoomAccount(db,actor,"41");
 assert.match(response.text,/mismatch/);
 assert.doesNotMatch(response.text,/18,000/);
});
