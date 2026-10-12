import test from "node:test";
import assert from "node:assert/strict";
import { managementIntent, financialMonthFromQuestion, summarizeUnpaidRows } from "../src/lib/assistant-management-intents";

test("recognizes non-sensitive debtor questions and a specific due-date month", () => {
 assert.deepEqual(managementIntent("Who hasn't paid?"),{kind:"debtors",month:null});
 assert.deepEqual(managementIntent("List outstanding rent for October 2026"),{kind:"debtors",month:"2026-10"});
 assert.deepEqual(managementIntent("Show debtors 2026-09"),{kind:"debtors",month:"2026-09"});
 assert.deepEqual(managementIntent("Nani hajalipa?"),{kind:"debtors",month:null});
 assert.equal(financialMonthFromQuestion("show outstanding in May 2025"),"2025-05");
 assert.equal(managementIntent("The student hasn't paid but do not tell management"),null);
});
test("recognizes collections and write-intent only as form navigation",()=>{
 assert.deepEqual(managementIntent("How much have we collected?"),{kind:"collected",month:null});
 assert.deepEqual(managementIntent("Total money received October 2026"),{kind:"collected",month:"2026-10"});
 assert.deepEqual(managementIntent("Register a student named Jane"),{kind:"register"});
 assert.deepEqual(managementIntent("Add payment KES 9000 to her account"),{kind:"payment"});
 assert.equal(managementIntent("What is the tenant's password?"),null);
});
test("groups different students by unique id even when names are identical",()=>{
 const rows=[
 {id:"a",studentId:"x",studentName:"Student A",rooms:["54"],currency:"KES",amount:28000,payments:[{amount:4500,currency:"KES",organizationId:"hostel",studentId:"x"},{amount:9000,currency:"KES",organizationId:"hostel",studentId:"x"}]},
 {id:"b",studentId:"x",studentName:"Student A",rooms:["54"],currency:"KES",amount:1000,payments:[]},
 {id:"c",studentId:"y",studentName:"Student A",rooms:["24"],currency:"KES",amount:18000,payments:[{amount:9000,currency:"KES",organizationId:"hostel",studentId:"y"}]},
 {id:"d",studentId:"z",studentName:"Paid Student",rooms:["11"],currency:"KES",amount:4500,payments:[{amount:4500,currency:"KES",organizationId:"hostel",studentId:"z"}]},
 ];
 const result=summarizeUnpaidRows(rows,"KES",null,new Date("2026-10-12T12:00:00Z"));
 assert.equal(result.inconsistent,false);
 assert.match(result.text,/2 students owe KES 24,500\.00 across 3 outstanding charges/);
 assert.match(result.text,/Student A \(Room 54\) — KES 15,500\.00/);
 assert.match(result.text,/Student A \(Room 24\) — KES 9,000\.00/);
 assert.doesNotMatch(result.text,/Paid Student/);
});
test("prevents financial answer from a mismatched payment identity or currency",()=>{
 const make=(overrides={})=>({id:"a",studentId:"x",studentName:"A",rooms:[],currency:"KES",amount:1000,payments:[{amount:500,currency:"KES",organizationId:"hostel",studentId:"x"}],...overrides});
 assert.equal(summarizeUnpaidRows([make({currency:"USD"})],"KES",null,new Date()).inconsistent,true);
 assert.equal(summarizeUnpaidRows([make({payments:[{amount:500,currency:"KES",organizationId:"hostel",studentId:"y"}]})],"KES",null,new Date()).inconsistent,true);
});
test("reversed receipts are excluded by the database query and balance arithmetic does not double-count credits",()=>{
 const item={id:"a",studentId:"x",studentName:"A",rooms:["1"],currency:"KES",amount:3000,payments:[{amount:5000,currency:"KES",organizationId:"hostel",studentId:"x"}]};
 const result=summarizeUnpaidRows([item],"KES",null,new Date("2026-10-12T10:00:00Z"));
 assert.match(result.text,/0 students owe KES 0\.00/);
 assert.equal(result.inconsistent,false);
});
