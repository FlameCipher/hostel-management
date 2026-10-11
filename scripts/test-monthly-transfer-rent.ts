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
console.log("Month-boundary rent tests passed");
