import assert from "node:assert/strict";
import {
  auditActiveOccupancy, financialAuditSummary,
  type FinancialAuditOccupancy,
} from "../src/lib/financial-integrity-audit";

const date=(day:string)=>new Date(day+"T12:00:00.000Z");
function fixture():FinancialAuditOccupancy {
  return {
    id:"occupancy-joseph",organizationId:"hostel-A",studentId:"student-joseph",
    studentName:"Joseph",roomId:"room24",roomNumber:"24",
    roomTypeId:"shared",roomTypeName:"Single Room Shared",
    monthlyRate:3500,semesterRate:14000,
    stays:[
      {roomId:"room23",roomNumber:"23",startDate:date("2026-09-29"),endDate:date("2026-10-11"),monthlyRate:4500,semesterRate:18000},
      {roomId:"room24",roomNumber:"24",startDate:date("2026-10-11"),endDate:null,monthlyRate:3500,semesterRate:14000},
    ],
    charges:[{
      id:"rent-joseph",amount:18000,currency:"KES",status:"PARTIALLY_PAID",
      description:"First semester rent · Room 23",roomTypeId:"private",
      payments:[{amount:9000,currency:"KES",studentId:"student-joseph",organizationId:"hostel-A"}],
      adjustments:[],
    }],
  };
}
const joseph=fixture();
const snapshot=JSON.stringify(joseph);
const j=auditActiveOccupancy(joseph);
assert.deepEqual(j.map(f=>f.code).sort(),[
  "RENT_OLD_ROOM_LABEL","RENT_ROOM_TYPE_MISMATCH","TRANSFER_RATE_UNREVIEWED",
].sort());
assert.equal(JSON.stringify(joseph),snapshot,"A read-only audit must not mutate source records.");
assert.ok(j.every(f=>f.severity!=="critical"));
assert.ok(j.some(f=>f.detail.includes("Confirm the applicable agreement")));

const sheila=fixture();
sheila.studentId="student-sheila";
sheila.studentName="Sheila";
sheila.roomId="room54";
sheila.roomNumber="54";
sheila.roomTypeId="bedsitter-private";
sheila.roomTypeName="Bedsitter Private";
sheila.monthlyRate=7000;
sheila.semesterRate=28000;
sheila.stays=[
  {roomId:"room60",roomNumber:"60",startDate:date("2026-09-05"),endDate:date("2026-10-11"),monthlyRate:4500,semesterRate:18000},
  {roomId:"room54",roomNumber:"54",startDate:date("2026-10-11"),endDate:null,monthlyRate:7000,semesterRate:28000},
];
sheila.charges=[{
  id:"rent-sheila",amount:28000,currency:"KES",status:"PARTIALLY_PAID",
  description:"First semester rent · Room 54 (Bedsitter Private)",roomTypeId:"bedsitter-private",
  payments:[
    {amount:4500,currency:"KES",studentId:"student-sheila",organizationId:"hostel-A"},
    {amount:9000,currency:"KES",studentId:"student-sheila",organizationId:"hostel-A"},
  ],
  adjustments:[
    {reason:"RATE_CORRECTION",calculationMethod:"STANDARD_RATE"},
    {reason:"RATE_CORRECTION",calculationMethod:"CUSTOM"},
  ],
}];
assert.deepEqual(auditActiveOccupancy(sheila),[],
  "An owner-approved full destination-semester override must not be rewritten or falsely flagged.");
assert.equal(sheila.charges[0].amount,28000);
assert.deepEqual(sheila.charges[0].payments.map(p=>p.amount),[4500,9000]);

const sameRate=fixture();
sameRate.roomTypeId="private";
sameRate.roomTypeName="Single Room Private";
sameRate.monthlyRate=4500;
sameRate.semesterRate=18000;
sameRate.stays[1].semesterRate=18000;
sameRate.stays[1].monthlyRate=4500;
sameRate.charges[0].roomTypeId="private";
const onlyLabel=auditActiveOccupancy(sameRate);
assert.deepEqual(onlyLabel.map(f=>f.code),["RENT_OLD_ROOM_LABEL"]);
assert.equal(financialAuditSummary([{findings:onlyLabel}]).needingReview,0);

const missing=fixture();
missing.charges=[];
assert.ok(auditActiveOccupancy(missing).some(f=>f.code==="RENT_CHARGE_MISSING"));
const duplicate=fixture();
duplicate.charges=[...duplicate.charges,{...duplicate.charges[0],id:"duplicate"}];
assert.ok(auditActiveOccupancy(duplicate).some(f=>f.code==="RENT_CHARGE_DUPLICATE"));
const overpaid=fixture();
overpaid.charges[0].payments[0].amount=19000;
assert.ok(auditActiveOccupancy(overpaid).some(f=>f.code==="RENT_OVERPAID"));
const invalidPayment=fixture();
invalidPayment.charges[0].payments[0].organizationId="hostel-B";
assert.ok(auditActiveOccupancy(invalidPayment).some(f=>f.code==="RENT_PAYMENT_LINKAGE"));
const brokenStay=fixture();
brokenStay.stays[1].startDate=date("2026-10-12");
assert.ok(auditActiveOccupancy(brokenStay).some(f=>f.code==="ROOM_HISTORY_GAP"));
const wrongState=fixture();
wrongState.charges[0].status="FULLY_PAID";
assert.ok(auditActiveOccupancy(wrongState).some(f=>f.code==="RENT_STATUS_INCONSISTENT"));

const summary=financialAuditSummary([
  {findings:j},{findings:auditActiveOccupancy(sheila)},{findings:onlyLabel},
  {findings:auditActiveOccupancy(missing)},
]);
assert.equal(summary.occupancies,4);
assert.equal(summary.needingReview,2);
assert.ok(summary.critical>0);
assert.equal(summary.informational,2);

console.log("Read-only hostel financial-integrity audit tests passed.");
