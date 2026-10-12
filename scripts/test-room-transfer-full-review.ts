import assert from "node:assert/strict";
import {reviewRoomTransfers,transferReviewFingerprint,type TransferReviewRecord} from "../src/lib/room-transfer-review";
import {validateTransferPreflight} from "../src/lib/room-transfer-preflight";
import {transferReviewNavigationRequest} from "../src/lib/room-transfer-review-intents";

const day=(s:string)=>new Date(s+"T12:00:00.000Z");
const shared={
  organizationId:"mama-mbugua-hostel",
  id:"occupancy-sheila",studentId:"student-sheila",
  studentName:"SHEILA NYABOKE MOTWANA",status:"ACTIVE",
  roomId:"room54",currentRoom:"54",roomTypeId:"bedsitter-private",
  semesterName:"First semester",semesterStart:day("2026-09-01"),
  semesterEnd:day("2026-12-24"),
};
const sheila:TransferReviewRecord={
  ...shared,
  stays:[
    {id:"stay60",roomId:"room60",roomNumber:"60",
      roomTypeId:"single-private",roomTypeName:"Single Room Private",
      startDate:day("2026-09-05"),endDate:day("2026-10-11"),
      monthlyRate:4500,semesterRate:18000},
    {id:"stay54",roomId:"room54",roomNumber:"54",
      roomTypeId:"bedsitter-private",roomTypeName:"Bedsitter Private",
      startDate:day("2026-10-11"),endDate:null,
      monthlyRate:7000,semesterRate:28000},
  ],
  charges:[{
    id:"charge-sheila",amount:28000,baseAmount:18000,
    currency:"KES",status:"PARTIALLY_PAID",
    roomTypeId:"bedsitter-private",
    description:"First semester rent · Room 54 (Bedsitter Private)",
    payments:[
      {amount:4500,currency:"KES",studentId:"student-sheila",organizationId:"mama-mbugua-hostel"},
      {amount:9000,currency:"KES",studentId:"student-sheila",organizationId:"mama-mbugua-hostel"},
    ],
    adjustments:[
      {reason:"RATE_CORRECTION",calculationMethod:"STANDARD_RATE",explanation:"Historical accommodation correction"},
      {reason:"RATE_CORRECTION",calculationMethod:"CUSTOM",explanation:"Owner-approved full destination room rent"},
    ],
  }],
};
const original=JSON.stringify(sheila);
const a=reviewRoomTransfers(sheila);
assert.equal(a.recordedRent,28000);
assert.equal(a.paid,13500);
assert.equal(a.balance,14500);
assert.equal(a.transferCount,1);
assert.equal(a.ownerOverride,true);
assert.deepEqual(a.monthly?.lines.map(x=>x.rate),[4500,7000,7000,7000]);
assert.equal(a.monthly?.total,25500);
assert.equal(a.monthly?.balance,12000);
assert.equal(a.destination?.rent,28000);
assert.equal(a.destination?.balance,14500);
assert.deepEqual(a.flags.map(x=>x.code),["OWNER_OVERRIDE_PRESERVED"]);
assert.equal(a.fingerprint,transferReviewFingerprint(sheila));
assert.equal(JSON.stringify(sheila),original,"All previews must be read-only.");
assert.equal(a.fingerprint.length,64);

const joseph:TransferReviewRecord={
  ...shared,id:"occupancy-joseph",studentId:"student-joseph",studentName:"Joseph Omesa",
  roomId:"room24",currentRoom:"24",roomTypeId:"single-private",
  stays:[
    {id:"stay23",roomId:"room23",roomNumber:"23",
      roomTypeId:"single-private",roomTypeName:"Single Room Private",
      startDate:day("2026-09-29"),endDate:day("2026-10-11"),
      monthlyRate:4500,semesterRate:18000},
    {id:"stay24",roomId:"room24",roomNumber:"24",
      roomTypeId:"single-private",roomTypeName:"Single Room Private",
      startDate:day("2026-10-11"),endDate:null,monthlyRate:4500,semesterRate:18000},
  ],
  charges:[{...sheila.charges[0],id:"charge-joseph",amount:18000,
    baseAmount:18000,roomTypeId:"single-private",status:"PARTIALLY_PAID",
    description:"First semester rent · Room 24 (Single Room Private)",
    payments:[{amount:9000,currency:"KES",studentId:"student-joseph",organizationId:"mama-mbugua-hostel"}],
    adjustments:[],
  }],
};
const j=reviewRoomTransfers(joseph);
assert.equal(j.ownerOverride,false);
assert.equal(j.recordedRent,18000);
assert.equal(j.paid,9000);
assert.equal(j.balance,9000);
assert.equal(j.monthly?.total,18000);
assert.deepEqual(j.flags,[]);
assert.notEqual(j.fingerprint,a.fingerprint);

const stale=structuredClone(joseph);
stale.charges[0].description="First semester rent · Room 23";
assert.deepEqual(reviewRoomTransfers(stale).flags.map(x=>x.code),["OLD_ROOM_LABEL"]);
assert.notEqual(transferReviewFingerprint(stale),j.fingerprint);
const outOfOrder=structuredClone(joseph);
outOfOrder.stays[1].startDate=day("2026-10-10");
assert.ok(reviewRoomTransfers(outOfOrder).flags.some(f=>f.code==="INVALID_STAY_TIMELINE"));
const foreign=structuredClone(joseph);
foreign.charges[0].payments[0].organizationId="foreign-hostel";
assert.ok(reviewRoomTransfers(foreign).flags.some(f=>f.code==="PAYMENT_LINKAGE"));
const noCharge=structuredClone(joseph);
noCharge.charges=[];
assert.ok(reviewRoomTransfers(noCharge).flags.some(f=>f.code==="RENT_CHARGE_COUNT"));
const overpaid=structuredClone(joseph);
overpaid.charges[0].payments[0].amount=19000;
assert.ok(reviewRoomTransfers(overpaid).flags.some(f=>f.code==="OVERPAYMENT"));
const rateChanged=structuredClone(joseph);
rateChanged.stays[1].monthlyRate=3500;
rateChanged.stays[1].semesterRate=14000;
assert.equal(reviewRoomTransfers(rateChanged).monthly?.total,15000);

function preflight() {
  return {
    occupancyRoomId:"room23",occupancyCheckIn:day("2026-09-05"),
    semesterEnd:day("2026-12-24"),transferDate:day("2026-10-12"),
    stays:[{roomId:"room23",startDate:day("2026-09-05"),endDate:null}],
    chargeCount:1,chargeCurrency:"KES",originalRoomCurrency:"KES",
    destinationRoomCurrency:"KES",rentMethod:"KEEP_FULL",
    originalMonthlyRate:4500,destinationMonthlyRate:4500,
    originalSemesterRate:18000,destinationSemesterRate:18000,
  };
}
assert.equal(validateTransferPreflight(preflight()),true);
for(const rentMethod of ["KEEP_FULL","ACTUAL_DAYS","CUSTOM","MONTHLY"]){
  assert.throws(()=>validateTransferPreflight({
    ...preflight(),rentMethod,transferDate:day("2026-09-05"),
  }),/INVALID_TRANSFER_DATE/);
  assert.throws(()=>validateTransferPreflight({
    ...preflight(),rentMethod,transferDate:day("2026-09-04"),
  }),/INVALID_TRANSFER_DATE/);
  assert.throws(()=>validateTransferPreflight({
    ...preflight(),rentMethod,stays:[
      {roomId:"room23",startDate:day("2026-09-05"),endDate:day("2026-10-10")},
      {roomId:"room23",startDate:day("2026-10-11"),endDate:null},
    ],
  }),/TRANSFER_HISTORY_REVIEW_REQUIRED/);
  assert.throws(()=>validateTransferPreflight({
    ...preflight(),rentMethod,stays:[{roomId:"foreign-room",startDate:day("2026-09-05"),endDate:null}],
  }),/TRANSFER_HISTORY_REVIEW_REQUIRED/);
}
assert.throws(()=>validateTransferPreflight({...preflight(),chargeCount:2}),/TRANSFER_CHARGE_REVIEW_REQUIRED/);
assert.throws(()=>validateTransferPreflight({...preflight(),destinationRoomCurrency:"USD"}),/TRANSFER_CURRENCY_REVIEW_REQUIRED/);
assert.throws(()=>validateTransferPreflight({...preflight(),destinationSemesterRate:14000}),/RENT_RECALC_REQUIRED/);
assert.throws(()=>validateTransferPreflight({...preflight(),destinationMonthlyRate:3500}),/RENT_RECALC_REQUIRED/);
assert.equal(validateTransferPreflight({...preflight(),rentMethod:"CUSTOM",
  destinationMonthlyRate:7000,destinationSemesterRate:28000}),true);
assert.equal(validateTransferPreflight({...preflight(),stays:[]}),true,
  "Old imported records with no stay history may still use the existing controlled backfill path.");

assert.equal(transferReviewNavigationRequest("Show room transfers"),true);
assert.equal(transferReviewNavigationRequest("Review transfer history"),true);
assert.equal(transferReviewNavigationRequest("Audit room changes"),true);
assert.equal(transferReviewNavigationRequest("Show unpaid tenants"),false);
assert.equal(transferReviewNavigationRequest("Change room 54 rent to 28000"),false);
assert.equal(transferReviewNavigationRequest("Send receipt to tenant"),false);
console.log("Full room-transfer chronology, owner override, rent scenarios, payment isolation and preflight tests passed.");
