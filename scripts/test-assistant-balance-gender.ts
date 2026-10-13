import assert from "node:assert/strict";
import test from "node:test";
import type {PrismaClient} from "../src/generated/prisma/client";
import {genderReportIntent,financialBalanceIntent,contextualBalanceFollowup} from "../src/lib/assistant-report-intents";
import {answerOutstandingTotal} from "../src/lib/assistant-outstanding-total";
import {answerStudentGenderReport} from "../src/lib/assistant-student-demographics";
import {managementIntent} from "../src/lib/assistant-management-intents";
import {answerHostelQuestion} from "../src/lib/assistant-service";

test("user screenshot balance question requests outstanding money, never collections",()=>{
 for(const q of ["How much is balance","How much is the balance?","What's the outstanding balance?","Total hostel balance","How much rent remains owing?","Show total unpaid balances"])
  assert.equal(financialBalanceIntent(q),"outstanding",q);
 assert.deepEqual(managementIntent("How much is balance"),{kind:"collected",month:null});
 for(const q of ["How much is our bank balance?","What is the M-Pesa balance?"])
  assert.equal(financialBalanceIntent(q),"bank-unavailable",q);
 assert.equal(financialBalanceIntent("How much did we collect?"),null);
 assert.equal(financialBalanceIntent("What is his balance?"),null);
});
test("user screenshot gender question is classified as official student report, not AI guess",()=>{
 for(const q of ["How many students are male and female","How many boys and girls are in the hostel?","Show the gender breakdown of students","Female and male student statistics"])
  assert.equal(genderReportIntent(q),true,q);
 for(const q of ["How many rooms available?","Are there female shared rooms?","What is the rent?"])
  assert.equal(genderReportIntent(q),false,q);
});
test("contextual balance resolves only signed subject and never alters unrelated global totals",()=>{
 for(const q of ["How much is balance","What is her balance?","How much is his balance?","Balance due","How much is remaining?"])
  assert.equal(contextualBalanceFollowup(q),true,q);
 for(const q of ["What is the overall hostel balance?","How much is our bank balance?","What's room 41 balance?"])
  assert.equal(contextualBalanceFollowup(q),false,q);
});
test("read-only outstanding totals use only unreversed hostel charges and never bank receipts",async()=>{
 let chargeQuery:any=null;
 const db={
  organization:{findUnique:async({where}:any)=>{assert.equal(where.id,"hostel-one");return{currency:"KES"}}},
  charge:{findMany:async(q:any)=>{chargeQuery=q;return[
   {studentId:"s1",organizationId:"hostel-one",currency:"KES",amount:18000,
    payments:[{amount:4500,organizationId:"hostel-one",studentId:"s1",currency:"KES"}]},
   {studentId:"s2",organizationId:"hostel-one",currency:"KES",amount:28000,
    payments:[{amount:13500,organizationId:"hostel-one",studentId:"s2",currency:"KES"}]},
   {studentId:"s3",organizationId:"hostel-one",currency:"KES",amount:14000,
    payments:[{amount:14000,organizationId:"hostel-one",studentId:"s3",currency:"KES"}]},
  ];}},
  payment:{findMany:async()=>assert.fail("Balance cannot be gross collections")}
 } as unknown as PrismaClient;
 const r=await answerOutstandingTotal(db,"hostel-one",{kind:"all",label:"All"});
 assert.equal(chargeQuery.where.organizationId,"hostel-one");
 assert.deepEqual(chargeQuery.select.payments.where,{reversedAt:null});
 assert.match(r.text,/Total outstanding hostel balance.*KES 28,000.00/);
 assert.match(r.text,/2 students have 2 unpaid or partly paid charges/);
 assert.doesNotMatch(r.text,/353,500/);
});
test("different student or currency payment blocks balance rather than guesses",async()=>{
 const db={
  organization:{findUnique:async()=>({currency:"KES"})},
  charge:{findMany:async()=>[{studentId:"one",organizationId:"hostel-one",currency:"KES",amount:18000,
   payments:[{studentId:"foreign",organizationId:"hostel-one",currency:"KES",amount:9000}]}]}
 } as unknown as PrismaClient;
 const r=await answerOutstandingTotal(db,"hostel-one",{kind:"all",label:"All"});
 assert.match(r.text,/identity or currency discrepancy/);
 assert.doesNotMatch(r.text,/KES 9,000/);
});
test("gender report counts recorded choices and separates unrecorded without inference",async()=>{
 const db={student:{groupBy:async({where,by}:any)=>{
  assert.equal(where.organizationId,"hostel-one");
  assert.equal(where.status,"ACTIVE");
  assert.deepEqual(by,["gender"]);
  return[
   {gender:"MALE",_count:{_all:2}},
   {gender:"FEMALE",_count:{_all:3}},
   {gender:null,_count:{_all:4}},
   {gender:"PREFER_NOT_TO_SAY",_count:{_all:1}}
  ];
 }}} as unknown as PrismaClient;
 const r=await answerStudentGenderReport(db,"hostel-one");
 assert.match(r.text,/Male: 2/);assert.match(r.text,/Female: 3/);
 assert.match(r.text,/Prefer not to disclose: 1/);
 assert.match(r.text,/Not recorded: 4/);assert.match(r.text,/Total active students: 10/);
 assert.match(r.text,/complete male\/female totals are therefore unknown/);
});
test("all unrecorded gender must not imply zero men or women at hostel",async()=>{
 const db={student:{groupBy:async()=>[{gender:null,_count:{_all:32}}]}} as unknown as PrismaClient;
 const r=await answerStudentGenderReport(db,"hostel-one");
 assert.match(r.text,/Total active students: 32/);
 assert.match(r.text,/do NOT establish that the hostel has no male or female students/);
});
test("authorized hostel assistant runs screenshot questions without calling external model",async()=>{
 const identity={userId:"manager-id",organizationId:"hostel-one",name:"Manager",role:"OWNER" as const,sessionVersion:0};
 const calls={finance:0,gender:0};
 const db={
  user:{findFirst:async()=>({id:"manager-id",role:"OWNER",sessionVersion:0})},
  organization:{findUnique:async()=>({currency:"KES"})},
  charge:{findMany:async()=>{calls.finance++;return[]}},
  student:{groupBy:async()=>{calls.gender++;return[{gender:null,_count:{_all:32}}]}},
 } as unknown as PrismaClient;
 const provider=async()=>{assert.fail("Do not route known reports to general provider");return{text:"",inputTokens:0,outputTokens:0}};
 const balance=await answerHostelQuestion(db,identity,false,"How much is balance",provider);
 assert.equal(balance.mode,"records");assert.match(balance.text,/Total outstanding hostel balance/);
 const gender=await answerHostelQuestion(db,identity,false,"How many students are male and female",provider);
 assert.equal(gender.mode,"records");assert.match(gender.text,/Not recorded: 32/);
 assert.equal(calls.finance,1);assert.equal(calls.gender,1);
});
