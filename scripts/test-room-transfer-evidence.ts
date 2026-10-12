import assert from "node:assert/strict";
import type {PrismaClient} from "../src/generated/prisma/client";
import type {SessionPayload} from "../src/lib/auth/session";
import {
  evidenceNoteId,recordTransferEvidenceNote,validateTransferEvidenceNote,
} from "../src/lib/room-transfer-evidence";
import {loadTransferReviewRecord} from "../src/lib/room-transfer-data";
import {transferReviewFingerprint} from "../src/lib/room-transfer-review";

const d=(v:string)=>new Date(v+"T12:00:00Z");
const id="7cb6d73d-78e9-48c8-a4e9-7ec0658d5f08";
const owner:SessionPayload={
  userId:"owner",organizationId:"hostel-A",name:"Owner",role:"OWNER",sessionVersion:2,
};
function occupancy(){
  return {
    id:"occupancy-1",organizationId:"hostel-A",studentId:"student-1",
    status:"ACTIVE",roomId:"room54",
    student:{fullName:"Student One"},
    room:{number:"54",roomTypeId:"bedsitter"},
    semester:{name:"First semester",startDate:d("2026-09-01"),endDate:d("2026-12-24")},
    roomStays:[
      {id:"stay60",roomId:"room60",roomTypeId:"single",
        startDate:d("2026-09-05"),endDate:d("2026-10-11"),
        monthlyRateSnapshot:4500,semesterRateSnapshot:18000,
        room:{number:"60"},roomType:{name:"Single Private"}},
      {id:"stay54",roomId:"room54",roomTypeId:"bedsitter",
        startDate:d("2026-10-11"),endDate:null,
        monthlyRateSnapshot:7000,semesterRateSnapshot:28000,
        room:{number:"54"},roomType:{name:"Bedsitter Private"}},
    ],
    charges:[{
      id:"charge1",amount:28000,baseAmount:18000,currency:"KES",
      status:"PARTIALLY_PAID",roomTypeId:"bedsitter",description:"First semester rent · Room 54",
      payments:[
        {amount:4500,currency:"KES",studentId:"student-1",organizationId:"hostel-A"},
        {amount:9000,currency:"KES",studentId:"student-1",organizationId:"hostel-A"},
      ],
      adjustments:[{reason:"RATE_CORRECTION",calculationMethod:"CUSTOM",
        explanation:"Owner-approved full semester rent"}],
    }],
  };
}
const request={
  occupancyId:"occupancy-1",fingerprint:"",requestId:id,
  noteType:"REPORTED_DISCREPANCY" as const,
  note:"The owner reports only two physical days in the previous room; check documentary evidence.",
  evidenceReference:"Security movement log - not yet verified",
  reportedPhysicalMoveDate:"2026-10-11",
};

function fixture(options?:{actor?:boolean;version?:number;foreign?:boolean;changed?:boolean}){
  const data=occupancy();
  if(options?.changed)data.charges[0].amount=27000;
  const auditNotes=new Map<string,unknown>();
  let occupancyQueries=0;
  const tx={
    user:{findFirst:async(input:unknown)=>{
      assert.equal((input as {where:{organizationId:string}}).where.organizationId,"hostel-A");
      return options?.actor===false?null:{id:"owner",sessionVersion:options?.version??2};
    }},
    occupancy:{findFirst:async(input:unknown)=>{
      occupancyQueries++;
      assert.equal((input as {where:{organizationId:string}}).where.organizationId,"hostel-A");
      if(options?.foreign)return null;
      return data;
    }},
    auditLog:{createMany:async({skipDuplicates,data}:{skipDuplicates:boolean;data:Array<{id:string;organizationId:string;action:string;metadata:Record<string,unknown>}>})=>{
      assert.equal(skipDuplicates,true);
      assert.equal(data.length,1);
      assert.equal(data[0].organizationId,"hostel-A");
      assert.equal(data[0].action,"ROOM_TRANSFER_EVIDENCE_NOTE");
      assert.equal(data[0].metadata.physicalPresenceVerified,false);
      assert.equal(data[0].metadata.financialRecordsChanged,false);
      assert.equal(data[0].metadata.originalOccupancyHistoryChanged,false);
      if(auditNotes.has(data[0].id))return {count:0};
      auditNotes.set(data[0].id,data[0]);
      return {count:1};
    }},
  };
  const database={
    $transaction:async(fn:(t:typeof tx)=>Promise<unknown>,opts:unknown)=>{
      assert.equal((opts as {isolationLevel:string}).isolationLevel,"Serializable");
      return fn(tx);
    },
  } as unknown as PrismaClient;
  return {database,tx,data,auditNotes,get queries(){return occupancyQueries}};
}
async function run(){
  const setup=fixture();
  const record=await loadTransferReviewRecord(
    setup.tx as unknown as PrismaClient,"hostel-A","occupancy-1");
  assert.ok(record);
  const fingerprint=transferReviewFingerprint(record!);
  const validRequest={...request,fingerprint};
  const input=validateTransferEvidenceNote(validRequest);
  assert.equal(input.noteType,"REPORTED_DISCREPANCY");
  assert.equal(evidenceNoteId("hostel-A","occupancy-1",id),
    evidenceNoteId("hostel-A","occupancy-1",id));
  assert.notEqual(evidenceNoteId("hostel-A","occupancy-1",id),
    evidenceNoteId("hostel-B","occupancy-1",id));
  assert.throws(()=>validateTransferEvidenceNote({
    ...validRequest,note:"too short",
  }),/INVALID_REVIEW_NOTE/);
  assert.throws(()=>validateTransferEvidenceNote({
    ...validRequest,reportedPhysicalMoveDate:"2026-02-30",
  }),/INVALID_REVIEW_NOTE/);

  const before=JSON.stringify(setup.data);
  const created=await recordTransferEvidenceNote(setup.database,owner,validRequest);
  assert.equal(created.created,true);
  assert.equal(setup.auditNotes.size,1);
  const duplicate=await recordTransferEvidenceNote(setup.database,owner,validRequest);
  assert.equal(duplicate.created,false);
  assert.equal(setup.auditNotes.size,1);
  assert.equal(JSON.stringify(setup.data),before,"No financial or historical record may change.");

  const stale=fixture({changed:true});
  await assert.rejects(()=>recordTransferEvidenceNote(stale.database,owner,validRequest),/REVIEW_STALE/);
  assert.equal(stale.auditNotes.size,0);
  const foreign=fixture({foreign:true});
  await assert.rejects(()=>recordTransferEvidenceNote(foreign.database,owner,validRequest),/TRANSFER_CASE_UNAVAILABLE/);
  assert.equal(foreign.auditNotes.size,0);
  const inactive=fixture({actor:false});
  await assert.rejects(()=>recordTransferEvidenceNote(inactive.database,owner,validRequest),/NOT_AUTHORIZED/);
  assert.equal(inactive.queries,0);
  const version=fixture({version:99});
  await assert.rejects(()=>recordTransferEvidenceNote(version.database,owner,validRequest),/NOT_AUTHORIZED/);
  assert.equal(version.queries,0);
  const manager=fixture();
  await assert.rejects(()=>recordTransferEvidenceNote(manager.database,{...owner,role:"MANAGER"},validRequest),/NOT_AUTHORIZED/);
  assert.equal(manager.queries,0);
  console.log("Owner transfer evidence note service: replay, foreign tenant, stale ledger, revoked session and nonfinancial audit tests passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
