import test from "node:test";
import assert from "node:assert/strict";
import { arrearsPosition, arrearsMessage, arrearsCooldown, arrearsFingerprint, type ArrearsCharge } from "../src/lib/arrears-policy";
const now = new Date("2026-10-23T05:00:00Z");
const charge: ArrearsCharge = {id:"c",organizationId:"one",studentId:"s",currency:"KES",amount:"18000",dueDate:new Date("2026-10-01T00:00:00Z"),status:"OVERDUE",payments:[]};
const payment = (amount: string, reversedAt: Date | null = null) => ({amount,organizationId:"one",studentId:"s",currency:"KES",reversedAt});
const position = (charges: ArrearsCharge[]) => arrearsPosition(charges,"one","s","KES",now,"Africa/Nairobi");
test("only past due unpaid amounts are requested; due today and future charges excluded",()=>{
 assert.equal(position([charge,{...charge,id:"today",dueDate:now},{...charge,id:"future",dueDate:new Date("2026-11-01")}]).balance,18000);
});
test("partial payments reduce arrears, reversed payments do not, fully paid and waived are skipped",()=>{
 assert.equal(position([{...charge,payments:[payment("4500"),payment("9000"),payment("2000",now)]}]).balance,4500);
 assert.equal(position([{...charge,payments:[payment("18000")]},{...charge,status:"WAIVED"}]).balance,0);
});
test("cross-hostel, cross-tenant, currency mismatches, credits and invalid precision require review",()=>{
 for(const value of [{...charge,organizationId:"two"},{...charge,studentId:"other"},{...charge,currency:"USD"},{...charge,payments:[{...payment("100"),studentId:"other"}]},{...charge,payments:[payment("18001")]},{...charge,amount:"1.333"}]) assert.ok(position([value]).error);
});
test("local day boundaries prevent declaring today's charge overdue",()=>{
 assert.equal(arrearsPosition([{...charge,dueDate:new Date("2026-10-22T22:00:00Z")}],"one","s","KES",now,"Africa/Nairobi").balance,0);
});
test("weekly cooldown includes manual requests and expires at seven days",()=>{
 assert.equal(arrearsCooldown(new Date(now.getTime()-6*86400000),now),true);
 assert.equal(arrearsCooldown(new Date(now.getTime()-7*86400000),now),false);
 assert.equal(arrearsCooldown(null,now),false);
});
test("request contains only the tenant's balance, payment demand and account link",()=>{
 const text=arrearsMessage({hostel:"Fixture hostel",name:"Sample One",amount:4500,currency:"KES",due:"1 Oct 2026",login:"https://fixture.studentshostels.com/tenant/login"});
 assert.match(text,/KES 4,500.00/);assert.match(text,/Please clear/);assert.match(text,/already paid/);assert.ok(text.length<1000);
});
test("balance or recipient changes invalidate the reviewed snapshot",()=>{
 const row={studentId:"s",amount:4500,currency:"KES",due:"1 Oct 2026",phone:"254700000000",email:"",name:"Sample",room:"1"};
 assert.notEqual(arrearsFingerprint(row),arrearsFingerprint({...row,amount:2000}));assert.notEqual(arrearsFingerprint(row),arrearsFingerprint({...row,phone:"254700000001"}));
});
