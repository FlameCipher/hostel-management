import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import { requestedFinancePeriod, nairobiDayBounds } from "../src/lib/assistant-finance-period";
import { financialMonthFromQuestion, resolveFinanceWindow, managementLedgerAnswer } from "../src/lib/assistant-management-intents";

const now=new Date("2026-10-31T22:15:00.000Z"); // 1 Nov, 01:15 Nairobi
function period(text:string, month:string|null=null) {return requestedFinancePeriod(text,month,now);}
test("Nairobi local month boundary and last month do not use UTC calendar",()=>{
 const current=period("How much did we collect this month?");
 assert.equal(current.kind,"calendar");
 if(current.kind==="calendar"){
  assert.equal(current.start.toISOString(),"2026-10-31T21:00:00.000Z");
  assert.equal(current.end.toISOString(),"2026-11-30T21:00:00.000Z");
  assert.equal(current.label,"November 2026");
 }
 const last=period("What were last month's collections?");
 assert.equal(last.kind,"calendar");
 if(last.kind==="calendar"){
  assert.equal(last.start.toISOString(),"2026-09-30T21:00:00.000Z");
  assert.equal(last.end.toISOString(),"2026-10-31T21:00:00.000Z");
 }
});
test("today, yesterday, this week and last week use Nairobi calendar days",()=>{
 const today=period("Payments received today");
 const yesterday=period("Collections yesterday");
 assert.equal(today.kind,"calendar");assert.equal(yesterday.kind,"calendar");
 if(today.kind==="calendar"&&yesterday.kind==="calendar"){
  assert.equal(today.start.toISOString(),"2026-10-31T21:00:00.000Z");
  assert.equal(today.end.toISOString(),"2026-11-01T21:00:00.000Z");
  assert.equal(yesterday.end.toISOString(),today.start.toISOString());
 }
 const week=period("Payments this week");
 const lastWeek=period("How much last week?");
 assert.equal(week.kind,"calendar");assert.equal(lastWeek.kind,"calendar");
 if(week.kind==="calendar"&&lastWeek.kind==="calendar"){
  assert.equal(week.start.toISOString(),"2026-10-25T21:00:00.000Z");
  assert.equal(lastWeek.end.toISOString(),week.start.toISOString());
 }
 const b=nairobiDayBounds(new Date("2026-12-31T23:30:00Z"));
 assert.equal(b.start.toISOString(),"2026-12-31T21:00:00.000Z");
});
test("explicit months, current and previous semester, year and conflicting periods",()=>{
 assert.equal(period("Show collections October 2026","2026-10").kind,"calendar");
 assert.deepEqual(period("Who hasn't paid this semester?"),{kind:"semester",which:"current"});
 assert.deepEqual(period("Last semester debtors"),{kind:"semester",which:"previous"});
 assert.equal(period("Payments this year").kind,"calendar");
 assert.equal(period("Who has not paid this month and this semester?").kind,"ambiguous");
 assert.equal(period("Show this month and last month").kind,"ambiguous");
 assert.equal(period("How much money was received in 2025?").kind,"calendar");
 assert.equal(financialMonthFromQuestion("May I see collections this semester?"),null);
 assert.equal(financialMonthFromQuestion("Total payments for May 2025"),"2025-05");
});
test("current semester report selects only the organization's active semester, never all charges",async()=>{
 const now2=new Date("2026-10-13T00:00:00Z");
 const fake={semester:{findMany:async ({where}:any)=>{
  assert.deepEqual(where,{organizationId:"hostel",status:"ACTIVE"});
  return [{id:"s-current",name:"September–December 2026",startDate:new Date("2026-09-01T00:00:00Z"),endDate:new Date("2026-12-31T00:00:00Z")}];
 }}} as unknown as PrismaClient;
 const w=await resolveFinanceWindow(fake,"hostel",{kind:"semester",which:"current"},now2);
 assert.ok(w&&!("error" in w));
 if(w&&!("error" in w)){
  assert.equal(w.semesterId,"s-current");
  assert.equal(w.start.toISOString(),"2026-08-31T21:00:00.000Z");
  assert.equal(w.end.toISOString(),"2026-12-31T21:00:00.000Z");
 }
});
test("two active semesters and unknown active semester block estimates, not all-time fallback",async()=>{
 for(const options of [[],[
  {id:"s1",name:"S1",startDate:new Date("2026-09-01"),endDate:new Date("2026-12-31")},
  {id:"s2",name:"S2",startDate:new Date("2026-09-01"),endDate:new Date("2026-12-31")}
 ]]){
  const fake={organization:{findUnique:async()=>({currency:"KES"})},semester:{findMany:async()=>options},
    charge:{findMany:async()=>assert.fail("No broad ledger query permitted")}} as unknown as PrismaClient;
  const w=await managementLedgerAnswer(fake,"hostel","debtors",null,{kind:"semester",which:"current"},now);
  assert.match(w.text,/No all-time totals were substituted/);
 }
});
test("this month collections query filters paidAt, uses actual unreversed entries, not dueDate",async()=>{
 let query:any=null;
 const db={
  organization:{findUnique:async()=>({currency:"KES"})},
  payment:{findMany:async (q:any)=>{query=q;return[
   {amount:4500,currency:"KES",studentId:"resident-a",charge:{studentId:"resident-a",organizationId:"hostel"}},
   {amount:9000,currency:"KES",studentId:"resident-a",charge:{studentId:"resident-a",organizationId:"hostel"}}
  ];}}
 } as unknown as PrismaClient;
 const r=await managementLedgerAnswer(db,"hostel","collected",null,period("How much did we collect this month?"),now);
 assert.equal(query.where.reversedAt,null);
 assert.equal(query.where.organizationId,"hostel");
 assert.equal(query.where.paidAt.gte.toISOString(),"2026-10-31T21:00:00.000Z");
 assert.equal(query.where.paidAt.lt.toISOString(),"2026-11-30T21:00:00.000Z");
 assert.match(r.text,/Payments received during November 2026: KES 13,500.00/);
 assert.doesNotMatch(r.text,/All recorded unreversed payments/);
});
test("current semester debtor query scopes by semesterId and reports precise period",async()=>{
 let query:any=null;
 const db={
  organization:{findUnique:async()=>({currency:"KES"})},
  semester:{findMany:async()=>[{id:"semester-2026",name:"Sep–Dec",startDate:new Date("2026-09-01"),endDate:new Date("2026-12-31")}]},
  charge:{findMany:async(q:any)=>{query=q;return[
   {id:"rent",studentId:"resident",organizationId:"hostel",currency:"KES",amount:28000,
    student:{fullName:"Test Resident",occupancies:[{room:{number:"54"}}]},
    payments:[{amount:13500,currency:"KES",studentId:"resident",organizationId:"hostel"}]}
  ];}}
 } as unknown as PrismaClient;
 const r=await managementLedgerAnswer(db,"hostel","debtors",null,{kind:"semester",which:"current"},now);
 assert.equal(query.where.semesterId,"semester-2026");
 assert.equal(query.where.dueDate,undefined);
 assert.match(r.text,/Charges for semester Sep–Dec/);
 assert.match(r.text,/KES 14,500.00/);
});
test("calendar debtor report labels charge due dates, not payments received in month",async()=>{
 const db={
  organization:{findUnique:async()=>({currency:"KES"})},
  charge:{findMany:async({where}:any)=>{
    assert.equal(where.dueDate.gte.toISOString(),"2026-10-31T21:00:00.000Z");
    assert.equal(where.semesterId,undefined);
    return [];
  }}
 } as unknown as PrismaClient;
 const r=await managementLedgerAnswer(db,"hostel","debtors",null,period("Who owes this month?"),now);
 assert.match(r.text,/Charges due during November 2026/);
 assert.match(r.text,/due dates in this window/);
});
