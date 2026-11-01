import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { firstLateFeeDeadline, hostelDay, lateFeeDeadline, lateFeeAmount } from "../src/lib/late-fee-policy";
import { arrearsMessage } from "../src/lib/arrears-policy";

test("10% uses unpaid principal with exact currency rounding", () => {
  assert.equal(lateFeeAmount(9000,"KES"),900);
  assert.equal(lateFeeAmount(18000,"KES"),1800);
  assert.equal(lateFeeAmount(13500,"KES"),1350);
  assert.equal(lateFeeAmount(.05,"KES"),.01);
  assert.equal(lateFeeAmount(.04,"KES"),0);
  assert.equal(lateFeeAmount(0,"KES"),0);
  assert.throws(()=>lateFeeAmount(-1,"KES"));
  assert.throws(()=>lateFeeAmount(1.001,"KES"));
});
test("first deadline is a future 10th in Nairobi, including December rollover", () => {
  assert.equal(firstLateFeeDeadline(new Date("2026-11-01T06:00Z")),"2026-11-10");
  assert.equal(firstLateFeeDeadline(new Date("2026-11-09T21:00Z")),"2026-12-10");
  assert.equal(firstLateFeeDeadline(new Date("2026-12-31T23:00Z")),"2027-01-10");
  assert.equal(hostelDay(new Date("2026-11-10T21:00Z")),"2026-11-11");
});
test("recorded later due dates and approved extensions take priority", () => {
  assert.equal(lateFeeDeadline(new Date("2026-10-05"),"2026-11-10"),"2026-11-10");
  assert.equal(lateFeeDeadline(new Date("2026-12-15"),"2026-11-10"),"2026-12-15");
  assert.equal(lateFeeDeadline(new Date("2026-10-05"),"2026-11-10",new Date("2026-11-20")),"2026-11-20");
});
test("payment demand includes server-supplied dates without fill-in placeholders", () => {
  const message=arrearsMessage({hostel:"Fixture",name:"Resident",amount:9000,currency:"KES",due:"5 Oct 2026",noticeDate:"1 Nov 2026",penalty:"10% after 10 Nov 2026.",login:"https://example.invalid/tenant/login"});
  assert.match(message,/Notice date: 1 Nov 2026/);assert.match(message,/due from 5 Oct 2026/);assert.match(message,/10% after 10 Nov 2026/);assert.doesNotMatch(message,/\[date\]|\[deadline\]/i);
});
test("hostel voice contains no unrelated identity while retaining AI disclosure", () => {
  for(const file of ["src/components/system-assistant.tsx","src/components/use-assistant-narrator.ts","src/app/api/assistant/voice/route.ts","src/lib/assistant-voice-policy.ts"])assert.doesNotMatch(readFileSync(file,"utf8"),/kinari|sacred narrator/i);
  assert.match(readFileSync("src/components/system-assistant.tsx","utf8"),/AI-generated speech/);
});
