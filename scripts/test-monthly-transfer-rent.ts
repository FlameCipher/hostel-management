import assert from "node:assert/strict";
import { calculateMonthlyTransferRent } from "../src/lib/monthly-transfer-rent";

const result=calculateMonthlyTransferRent({
  currency:"KES",firstMonth:"2026-09",lastMonth:"2026-12",
  stays:[
    {roomId:"room60",startDate:new Date("2026-09-01T00:00:00Z"),monthlyRate:4500},
    {roomId:"room54",startDate:new Date("2026-10-15T00:00:00Z"),monthlyRate:7000},
  ],
});
assert.deepEqual(result.lines.map(x=>x.rate),[4500,7000,7000,7000]);
assert.deepEqual(result.lines.map(x=>x.roomId),["room60","room54","room54","room54"]);
assert.equal(result.total,25500);
assert.throws(()=>calculateMonthlyTransferRent({currency:"KES",firstMonth:"2026-13",lastMonth:"2026-12",stays:[]}),/INVALID_MONTH/);

const movedAgain=calculateMonthlyTransferRent({
  currency:"KES",firstMonth:"2026-09",lastMonth:"2026-12",
  stays:[
    {roomId:"room60",startDate:new Date("2026-09-01T00:00:00Z"),monthlyRate:4500},
    {roomId:"room54",startDate:new Date("2026-10-10T00:00:00Z"),monthlyRate:7000},
    {roomId:"room26",startDate:new Date("2026-11-02T00:00:00Z"),monthlyRate:5000},
  ],
});
assert.deepEqual(movedAgain.lines.map(x=>x.rate),[4500,7000,5000,5000]);
assert.equal(movedAgain.total,21500);
const cheaper=calculateMonthlyTransferRent({
  currency:"KES",firstMonth:"2026-09",lastMonth:"2026-12",
  stays:[
    {roomId:"a",startDate:new Date("2026-09-01T00:00:00Z"),monthlyRate:7000},
    {roomId:"b",startDate:new Date("2026-10-30T00:00:00Z"),monthlyRate:4500},
  ],
});
assert.deepEqual(cheaper.lines.map(x=>x.rate),[7000,4500,4500,4500]);
assert.throws(()=>calculateMonthlyTransferRent({currency:"KES",firstMonth:"2026-09",lastMonth:"2026-12",stays:[{roomId:"a",startDate:new Date("2026-10-01T00:00:00Z"),monthlyRate:4500}]}),/MISSING_MONTH_RATE/);
console.log("Month-boundary rent tests passed");
