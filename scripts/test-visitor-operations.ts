import assert from "node:assert/strict";
import type {PrismaClient} from "../src/generated/prisma/client";
import type {SessionPayload} from "../src/lib/auth/session";
import type {TenantSession} from "../src/lib/auth/tenant-session";
import {visitGatePreflight,summarizeVisitOperations} from "../src/lib/visitor-operations-policy";
import {summarizeTenantReadiness} from "../src/lib/tenant-visitor-operations-summary";
import {requestVisit,updateVisit} from "../src/lib/visitors";

const at=(s:string)=>new Date(s);
const now=at("2026-10-12T08:00:00.000Z");
const arrival=at("2026-10-12T09:00:00.000Z");
const departure=at("2026-10-12T12:00:00.000Z");
const template={
  id:"visit-1",organizationId:"hostel-A",studentId:"tenant-1",
  propertyId:"property-A",occupancyId:"occupancy-A",
  requestId:"b0c28a88-3fab-49af-9726-6eb7b0059a21",
  visitorName:"Guest One",visitorPhone:"254712345678",purpose:"Visit",
  vehicle:null,roomLabel:"24",timeZone:"Africa/Nairobi",
  expectedArrival:arrival,expectedDeparture:departure,status:"REQUESTED",
  checkedInAt:null as Date|null,checkedOutAt:null as Date|null,reviewNote:null as string|null,
};
const live={roomNumber:"24",propertyId:"property-A",studentId:"tenant-1",active:true};
assert.equal(visitGatePreflight(template,"CHECK_IN",now,live),null);
assert.equal(visitGatePreflight(template,"APPROVE",now,live),null);
assert.equal(visitGatePreflight(template,"CHECK_IN",now,{...live,roomNumber:"25"}),"HOST_ROOM_CHANGED");
assert.equal(visitGatePreflight(template,"CHECK_IN",now,{...live,propertyId:"property-B"}),"HOST_NO_LONGER_ELIGIBLE");
assert.equal(visitGatePreflight(template,"CHECK_IN",now,null),"HOST_NO_LONGER_ELIGIBLE");
assert.equal(visitGatePreflight(template,"CHECK_IN",at("2026-10-12T06:00:00Z"),live),"ARRIVAL_TOO_EARLY");
assert.equal(visitGatePreflight(template,"CHECK_IN",at("2026-10-12T12:10:00Z"),live),"VISIT_WINDOW_EXPIRED");
assert.equal(visitGatePreflight({...template,checkedInAt:now},"CHECK_IN",now,live),"INVALID_VISIT_HISTORY");
assert.equal(visitGatePreflight({...template,checkedInAt:now},"CHECK_OUT",now),null);
assert.equal(visitGatePreflight({...template,checkedInAt:now,checkedOutAt:now},"CHECK_OUT",now),"CHECKOUT_HISTORY_INVALID");
assert.equal(visitGatePreflight({...template,checkedInAt:at("2026-10-12T10:00:00Z")},"CHECK_OUT",now),"CHECKOUT_HISTORY_INVALID");
const summary=summarizeVisitOperations([
  {...template,status:"REQUESTED"},
  {...template,status:"APPROVED",expectedDeparture:at("2026-10-12T07:00:00Z")},
  {...template,status:"CHECKED_IN",expectedDeparture:at("2026-10-12T07:00:00Z")},
  {...template,status:"CHECKED_IN"},
  {...template,status:"CHECKED_OUT",checkedOutAt:now},
],now);
assert.deepEqual(summary,{expected:2,insideUnconfirmed:2,departureOverdue:1,expiredBeforeEntry:1,completed:1,total:5});
assert.equal(summarizeTenantReadiness({
  activeStudents:32,portalEnabled:1,eligibleForApproval:30,
  pendingRequests:0,expiredRequests:1,totalVisitorRequests:0,
}).notYetEnabled,31);

const staff:SessionPayload={
  userId:"security-1",organizationId:"hostel-A",name:"Gate",
  role:"CARETAKER",sessionVersion:0,
};
function gateFixture(options?:{
  room?:string;status?:string;expectedDeparture?:Date;checkedInAt?:Date|null;
  user?:boolean;sessionVersion?:number;foreign?:boolean;occupancy?:boolean;
}){
  const visit={...template,status:options?.status??"REQUESTED",
    expectedDeparture:options?.expectedDeparture??departure,
    checkedInAt:options?.checkedInAt??null};
  const audits:Array<unknown>=[];
  let changes=0;
  const tx={
    $queryRaw:async()=>[],
    user:{findFirst:async()=>options?.user===false?null:{
      id:"security-1",role:"CARETAKER",sessionVersion:options?.sessionVersion??0,
    }},
    visitorRequest:{
      findFirst:async({where}:{where:{organizationId:string}})=>{
        assert.equal(where.organizationId,"hostel-A");
        return options?.foreign?null:visit;
      },
      update:async({data}:{data:Record<string,unknown>})=>{
        Object.assign(visit,data);
        changes++;return visit;
      },
    },
    occupancy:{
      findFirst:async({where}:{where:{organizationId:string}})=>{
        assert.equal(where.organizationId,"hostel-A");
        return options?.occupancy===false?null:{
          studentId:"tenant-1",room:{number:options?.room??"24",propertyId:"property-A"},
        };
      },
    },
    auditLog:{create:async(input:unknown)=>{audits.push(input);return {};}},
  };
  const db={
    $transaction:async(fn:(client:typeof tx)=>Promise<unknown>)=>fn(tx),
  } as unknown as PrismaClient;
  return {db,visit,audits,get changes(){return changes}};
}
async function run() {
  const valid=gateFixture();
  let r=await updateVisit(valid.db,staff,{
    id:"visit-1",action:"CHECK_IN",verified:true,note:"Checked ID and host in person",
  },false,now);
  assert.ok(r.success,r.error);
  assert.equal(valid.changes,1);
  assert.equal(valid.visit.status,"CHECKED_IN");
  assert.equal(valid.visit.checkedInAt?.getTime(),now.getTime());
  assert.equal(valid.audits.length,1);
  r=await updateVisit(valid.db,staff,{
    id:"visit-1",action:"CHECK_IN",verified:true,note:"repeat",
  },false,now);
  assert.ok(r.error);assert.equal(valid.changes,1);
  const leaving=await updateVisit(valid.db,staff,{
    id:"visit-1",action:"CHECK_OUT",verified:true,note:"Verified visitor departure",
  },false,at("2026-10-12T08:25:00Z"));
  assert.ok(leaving.success,leaving.error);
  assert.equal(valid.visit.status,"CHECKED_OUT");
  assert.equal(valid.changes,2);
  assert.equal(valid.audits.length,2);
  const duplicateCheckout=await updateVisit(valid.db,staff,{
    id:"visit-1",action:"CHECK_OUT",verified:true,note:"duplicate",
  },false,at("2026-10-12T08:26:00Z"));
  assert.ok(duplicateCheckout.error);assert.equal(valid.changes,2);

  const moved=gateFixture({room:"25"});
  r=await updateVisit(moved.db,staff,{
    id:"visit-1",action:"CHECK_IN",verified:true,note:"",
  },false,now);
  assert.match(r.error??"",/moved rooms/i);
  assert.equal(moved.changes,0);assert.equal(moved.audits.length,0);

  const expired=gateFixture({expectedDeparture:at("2026-10-12T07:00:00Z")});
  r=await updateVisit(expired.db,staff,{
    id:"visit-1",action:"APPROVE",verified:true,note:"",
  },false,now);
  assert.match(r.error??"",/expired/i);assert.equal(expired.changes,0);

  const missing=gateFixture({occupancy:false});
  r=await updateVisit(missing.db,staff,{
    id:"visit-1",action:"CHECK_IN",verified:true,note:"",
  },false,now);
  assert.ok(r.error);assert.equal(missing.changes,0);

  const foreign=gateFixture({foreign:true});
  r=await updateVisit(foreign.db,staff,{
    id:"visit-1",action:"CHECK_IN",verified:true,note:"",
  },false,now);
  assert.ok(r.error);assert.equal(foreign.changes,0);

  const revoked=gateFixture({sessionVersion:9});
  r=await updateVisit(revoked.db,staff,{
    id:"visit-1",action:"CHECK_IN",verified:true,note:"",
  },false,now);
  assert.ok(r.error);assert.equal(revoked.changes,0);

  const unsigned=gateFixture();
  r=await updateVisit(unsigned.db,staff,{
    id:"visit-1",action:"CHECK_IN",verified:false,note:"",
  },false,now);
  assert.match(r.error??"",/verif/i);assert.equal(unsigned.changes,0);

  const tenant:TenantSession={
    studentId:"tenant-1",organizationId:"hostel-A",name:"Tenant One",
    sessionVersion:0,
  };
  const tdb={ $transaction:async()=>{throw Error("no tenant mutation allowed");}} as unknown as PrismaClient;
  r=await updateVisit(tdb,tenant,{
    id:"visit-1",action:"CHECK_IN",verified:true,note:"",
  },true,now);
  assert.ok(r.error);
  console.log("Visitor operations module checks: valid gate entry/exit, duplicate, changed room, expired, foreign, revoked, tenant boundaries passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
