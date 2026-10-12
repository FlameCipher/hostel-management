import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import { namedStudentAccountIntent,namedStudentAccountAnswer,isPrivateFinanceQuestion } from "../src/lib/assistant-student-account";
import { requestedFinancePeriod } from "../src/lib/assistant-finance-period";

const owner={organizationId:"hostel-a",role:"OWNER" as const};
const row=(name:string,id:string)=>({id,fullName:name,occupancies:[{room:{number:"54"}}]});
test("interprets person-specific financial questions without broad hostel collection",()=>{
 const questions={
  "How much has Sheila paid?":"Sheila",
  "What is Sheila Nyaboke's balance?":"Sheila Nyaboke",
  "Show Sheila's payments":"Sheila",
  "Check John Waigwa’s rent":"John Waigwa",
  "Payments for Sheila":"Sheila",
  "Balance for student Jane Doe":"Jane Doe",
 };
 for(const [question,name] of Object.entries(questions))
  assert.deepEqual(namedStudentAccountIntent(question),{name},question);
 for(const q of ["Who hasn't paid?","Who is in room 54 and what did they pay?","How much did we collect?"])
  assert.equal(namedStudentAccountIntent(q),null,q);
});
test("sensitive finance questions cannot fall through to a generic LLM",()=>{
 for(const question of ["How much did Sheila receive?","Who owes rent?","Show my MPESA receipt","What is John's balance?","Payment RJO1234"])
  assert.equal(isPrivateFinanceQuestion(question),true,question);
 assert.equal(isPrivateFinanceQuestion("How can I register a student?"),false);
});
test("ambiguous resident name refuses amounts and sends manager to protected search",async()=>{
 const db={
  organization:{findFirst:async()=>({currency:"KES"})},
  student:{findMany:async({where}:any)=>{
   assert.equal(where.organizationId,"hostel-a");
   assert.equal(where.fullName.contains,"Sheila");
   return[row("Sheila W", "a"),row("Sheila N","b")];
  }},
  charge:{findMany:async()=>assert.fail("Must not inspect charges of an ambiguous name")},
  payment:{findMany:async()=>assert.fail("Must not inspect payments of an ambiguous name")}
 } as unknown as PrismaClient;
 const r=await namedStudentAccountAnswer(db,owner,"Sheila");
 assert.match(r.text,/More than one hostel student matches/);
 assert.doesNotMatch(r.text,/KES/);
 assert.match(r.links[0].href,/^\/payments\?q=/);
});
test("authorized exact student matches only this hostel and matches its charge/payment IDs",async()=>{
 let payQuery:any=null,chargeQuery:any=null;
 const db={
  organization:{findFirst:async({where}:any)=>{assert.equal(where.id,"hostel-a");return{currency:"KES"};}},
  student:{findMany:async({where}:any)=>{assert.equal(where.organizationId,"hostel-a");return[row("Sheila Nyaboke","resident-id")];}},
  charge:{findMany:async(q:any)=>{chargeQuery=q;return [{
   studentId:"resident-id",organizationId:"hostel-a",currency:"KES",semesterId:"semester-2026",amount:28000,
   payments:[{studentId:"resident-id",organizationId:"hostel-a",currency:"KES",amount:13500}]
  }];}},
  payment:{findMany:async(q:any)=>{payQuery=q;return [
   {studentId:"resident-id",organizationId:"hostel-a",currency:"KES",amount:9000,charge:{studentId:"resident-id",organizationId:"hostel-a"}},
   {studentId:"resident-id",organizationId:"hostel-a",currency:"KES",amount:4500,charge:{studentId:"resident-id",organizationId:"hostel-a"}}
  ];}}
 } as unknown as PrismaClient;
 const r=await namedStudentAccountAnswer(db,owner,"Sheila Nyaboke");
 assert.equal(payQuery.where.studentId,"resident-id");
 assert.equal(payQuery.where.reversedAt,null);
 assert.equal(chargeQuery.where.studentId,"resident-id");
 assert.equal(chargeQuery.where.status.not,"WAIVED");
 assert.match(r.text,/Sheila Nyaboke/);
 assert.match(r.text,/Current registered room 54/);
 assert.match(r.text,/KES 13,500.00/);
 assert.match(r.text,/KES 14,500.00/);
 assert.doesNotMatch(r.text,/353,500/);
});
test("caretaker denied before database calls",async()=>{
 const db={student:{findMany:async()=>assert.fail("must not read student")},organization:{findFirst:async()=>assert.fail("must not read organization")}} as unknown as PrismaClient;
 const r=await namedStudentAccountAnswer(db,{organizationId:"hostel-a",role:"CARETAKER"},"Sheila");
 assert.match(r.text,/require authorized management finance access/);
});
test("named student period limits only payments received during requested month",async()=>{
 const period=requestedFinancePeriod("Payments for Sheila this month",null,new Date("2026-10-12T20:00:00Z"));
 const db={
  organization:{findFirst:async()=>({currency:"KES"})},
  student:{findMany:async()=>[row("Sheila Nyaboke","one")]},
  charge:{findMany:async()=>[]},
  payment:{findMany:async({where}:any)=>{
   assert.equal(where.paidAt.gte.toISOString(),"2026-09-30T21:00:00.000Z");
   assert.equal(where.paidAt.lt.toISOString(),"2026-10-31T21:00:00.000Z");
   return[];
  }}
 } as unknown as PrismaClient;
 const r=await namedStudentAccountAnswer(db,owner,"Sheila",period);
 assert.match(r.text,/Payments received during October 2026/);
});
test("invalid foreign charge linkage blocks the response instead of guessing",async()=>{
 const db={
  organization:{findFirst:async()=>({currency:"KES"})},
  student:{findMany:async()=>[row("Sheila","one")]},
  charge:{findMany:async()=>[{studentId:"one",organizationId:"hostel-a",currency:"KES",semesterId:null,amount:18000,payments:[]}]},
  payment:{findMany:async()=>[{studentId:"one",organizationId:"hostel-a",currency:"KES",amount:9000,charge:{studentId:"foreign",organizationId:"other-hostel"}}]}
 } as unknown as PrismaClient;
 const r=await namedStudentAccountAnswer(db,owner,"Sheila");
 assert.match(r.text,/identity or currency mismatch/);
 assert.doesNotMatch(r.text,/18,000/);
});
