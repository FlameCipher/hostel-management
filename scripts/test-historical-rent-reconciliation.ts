import assert from "node:assert/strict";
import { reconcileHistoricalTransfer } from "../src/lib/monthly-rent-reconciliation";

const first=new Date("2026-09-01T12:00:00Z"),move=new Date("2026-10-02T12:00:00Z"),last=new Date("2026-12-31T12:00:00Z");
const stays=[
 {roomId:"60",startDate:first,endDate:move,monthlyRate:4500},
 {roomId:"54",startDate:move,endDate:null,monthlyRate:7000},
];
const charge={amount:18000,currency:"KES",payments:[{amount:14000}],adjustments:[]};
const result=reconcileHistoricalTransfer({semesterStart:first,semesterEnd:last,stays,charges:[charge]});
assert.deepEqual(result.lines.map(x=>x.rate),[4500,7000,7000,7000]);
assert.equal(result.expected,25500);
assert.equal(result.recorded,18000);
assert.equal(result.paid,14000);
assert.equal(result.delta,7500);
assert.equal(result.balance,11500);
assert.equal(result.credit,0);
assert.equal(charge.amount,18000);
assert.equal(charge.payments[0].amount,14000);

const overpaid=reconcileHistoricalTransfer({semesterStart:first,semesterEnd:last,stays,charges:[{...charge,amount:30000,payments:[{amount:27000}]}]});
assert.equal(overpaid.credit,1500);
assert.equal(overpaid.balance,0);
assert.equal(overpaid.delta,-4500);

assert.throws(()=>reconcileHistoricalTransfer({semesterStart:first,semesterEnd:last,stays,charges:[charge,charge]}),/REVIEW_MULTIPLE_CHARGES/);
assert.throws(()=>reconcileHistoricalTransfer({semesterStart:first,semesterEnd:last,stays:[stays[0],{...stays[1],startDate:new Date("2026-10-03T12:00:00Z")}],charges:[charge]}),/REVIEW_ROOM_HISTORY_GAP/);
assert.throws(()=>reconcileHistoricalTransfer({semesterStart:first,semesterEnd:last,stays,charges:[{...charge,adjustments:[{reason:"DISCOUNT",calculationMethod:"CUSTOM",calculationData:null}]}]}),/REVIEW_SPECIAL_ADJUSTMENTS/);
assert.throws(()=>reconcileHistoricalTransfer({semesterStart:new Date("2026-09-15T12:00:00Z"),semesterEnd:last,stays,charges:[charge]}),/REVIEW_PARTIAL_SEMESTER/);
assert.throws(()=>reconcileHistoricalTransfer({semesterStart:first,semesterEnd:last,stays,charges:[{...charge,status:"WAIVED"}]}),/REVIEW_WAIVED_CHARGE/);
const alreadyReconciled=reconcileHistoricalTransfer({
  semesterStart:first,semesterEnd:last,stays,
  charges:[{...charge,amount:25500,adjustments:[{reason:"RATE_CORRECTION",calculationMethod:"STANDARD_RATE",calculationData:{method:"HISTORICAL_MONTHLY_CORRECTION"}}]}],
});
assert.equal(alreadyReconciled.delta,0);
assert.throws(()=>reconcileHistoricalTransfer({
  semesterStart:first,semesterEnd:last,stays,
  charges:[{...charge,adjustments:[{reason:"RATE_CORRECTION",calculationMethod:"CUSTOM",calculationData:{method:"HISTORICAL_MONTHLY_CORRECTION"}}]}],
}),/REVIEW_SPECIAL_ADJUSTMENTS/);
console.log("Historical rent reconciliation checks passed");
