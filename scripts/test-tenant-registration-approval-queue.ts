import assert from "node:assert/strict";
import type {PrismaClient} from "../src/generated/prisma/client";
import type {SessionPayload} from "../src/lib/auth/session";
import {
  groupPendingRegistrations,registrationCandidateTriage,
  registrationIdentityKey,activeQueueSummary,
  type PendingTenantRegistration,
} from "../src/lib/tenant-registration-triage";
import {reviewTenantRegistration} from "../src/lib/tenant-registration";

const now=new Date("2026-10-16T10:00:00.000Z");
const date=(v:string)=>new Date(v);
type Request=PendingTenantRegistration&{
  studentId:string|null;
  passwordHash:string|null;
  reviewedById:string|null;
  reviewedAt:Date|null;
};
function make(id:string,createdAt:string,overrides:Partial<Request>={}):Request{
  return {
    id,organizationId:"hostel-A",propertyId:"property-A",
    fullName:"Resident One",phone:"254712345678",roomNumber:"24",
    createdAt:date(createdAt),expiresAt:date("2026-10-20T00:00:00Z"),
    status:"PENDING",studentId:null,passwordHash:"hash-for-"+id,
    reviewedById:null,reviewedAt:null,...overrides,
  };
}
const older=make("old","2026-10-13T12:00:00Z");
const latest=make("latest","2026-10-14T12:00:00Z");
const unrelated=make("unrelated","2026-10-14T11:00:00Z",{
  phone:"254798765432",fullName:"Another Tenant",roomNumber:"54",
});
const conflicts=make("conflict","2026-10-14T14:00:00Z",{
  fullName:"Not Resident One",roomNumber:"60",
});
const grouped=groupPendingRegistrations([older,unrelated,latest],now);
assert.equal(grouped.length,2);
assert.equal(grouped.find(g=>g.latest.id==="latest")?.attempts.length,2);
assert.equal(grouped.find(g=>g.latest.id==="latest")?.phoneConflict,false);
assert.deepEqual(grouped.map(g=>g.latest.id),["latest","unrelated"]);
assert.notEqual(registrationIdentityKey(latest),registrationIdentityKey(conflicts));
assert.equal(groupPendingRegistrations([older,latest,conflicts],now).length,2);
assert.equal(groupPendingRegistrations([older,latest,conflicts],now)[0].phoneConflict,true);
assert.equal(groupPendingRegistrations([older,latest,make("expired","2026-10-01T12:00:00Z",{expiresAt:now})],now).length,1);
const students=[{
  id:"resident-1",fullName:" Resident   ONE ",phone:"0712345678",portalEnabled:false,
  portalPasswordHash:null,portalInviteBlocked:false,portalLastLoginAt:null,
  occupancies:[{status:"ACTIVE",room:{number:"24",propertyId:"property-A"}}],
}];
const triage=registrationCandidateTriage(grouped[0],students,"KE");
assert.equal(triage.reason,"EXACT_MATCH");
assert.equal(triage.approvable,true);
assert.equal(triage.matches[0].id,"resident-1");
assert.equal(registrationCandidateTriage(grouped[0],students,"GB").approvable,false);
assert.equal(registrationCandidateTriage(groupPendingRegistrations([older,latest,conflicts],now)[0],students,"KE").reason,"PHONE_CONFLICT");
assert.equal(registrationCandidateTriage(grouped[0],[{...students[0],portalEnabled:true}],"KE").reason,"ALREADY_ENABLED");
assert.equal(registrationCandidateTriage(grouped[0],[{...students[0],occupancies:[{status:"ACTIVE",room:{number:"22",propertyId:"property-A"}}]}],"KE").reason,"NO_EXACT_MATCH");
assert.deepEqual(activeQueueSummary(grouped,[triage,{reason:"NO_EXACT_MATCH"}]),{
  pendingGroups:2,attempts:3,repeatSubmissions:1,
  readyForIndependentVerification:1,needsInvestigation:1,phoneConflictGroups:0,
});

const owner:SessionPayload={
  userId:"owner-A",organizationId:"hostel-A",role:"OWNER",name:"Owner",
  sessionVersion:1,
};
function fixture(opts?:{
  includeConflict?:boolean;
  accountUsed?:boolean;
  noStudent?:boolean;
  wrongOrganization?:boolean;
}) {
  const rows=RequestArray(opts);
  let studentEnabled=opts?.accountUsed??false;
  let accountHash:string|null=opts?.accountUsed?"existing-hash":null;
  let approved=0,deletedTokens=0;
  const audits:Array<Record<string,unknown>>=[];
  const tx={
    $queryRaw:async()=>[],
    user:{findFirst:async()=>({id:"owner-A",role:"OWNER",sessionVersion:1})},
    tenantRegistration:{
      findFirst:async({where}:{where:{id:string;organizationId:string;status:string}})=>{
        if(opts?.wrongOrganization)return null;
        const item=rows.find(r=>r.id===where.id&&r.organizationId===where.organizationId&&r.status===where.status);
        return item?{...item,property:{id:"property-A",active:true,countryCode:"KE"}}:null;
      },
      findMany:async({where}:{where:{organizationId:string;propertyId:string;phone:string;status:string}})=>{
        assert.equal(where.organizationId,"hostel-A");
        return rows.filter(r=>r.organizationId===where.organizationId&&r.propertyId===where.propertyId&&
          r.phone===where.phone&&r.status===where.status&&r.expiresAt>now);
      },
      updateMany:async({where,data}:{where:{id:{in:string[]};status:string};data:Partial<Request>})=>{
        let count=0;
        for(const row of rows)if(where.id.in.includes(row.id)&&row.status===where.status){
          Object.assign(row,data);count++;
        }
        return {count};
      },
      update:async({where,data}:{where:{id:string};data:Partial<Request>})=>{
        const row=rows.find(r=>r.id===where.id);
        assert.ok(row);Object.assign(row,data);return row;
      },
    },
    student:{
      findFirst:async({where}:{where:{id:string;organizationId:string}})=>{
        assert.equal(where.organizationId,"hostel-A");
        if(opts?.noStudent||where.id!=="resident-1"||studentEnabled)return null;
        return {id:"resident-1",phone:"0712345678",fullName:"Resident One"};
      },
      update:async({where,data}:{where:{id:string};data:{portalEnabled:boolean;portalPasswordHash:string}})=>{
        assert.equal(where.id,"resident-1");studentEnabled=data.portalEnabled;accountHash=data.portalPasswordHash;approved++;return {};
      },
    },
    tenantPortalInvitation:{updateMany:async()=>{deletedTokens++;return {count:0}}},
    auditLog:{create:async({data}:{data:Record<string,unknown>})=>{audits.push(data);return {}}},
  };
  const db={$transaction:async(fn:(tx:typeof tx)=>Promise<unknown>)=>fn(tx)} as unknown as PrismaClient;
  return {db,rows,audits,
    get enabled(){return studentEnabled},
    get hash(){return accountHash},
    get approved(){return approved},
    get deletedTokens(){return deletedTokens},
  };
}
function RequestArray(opts?:{includeConflict?:boolean}):Request[]{
  return [structuredClone(older),structuredClone(latest),...(opts?.includeConflict?[structuredClone(conflicts)]:[])];
}
async function run(){
  const baseline=fixture();
  let result=await reviewTenantRegistration(baseline.db,owner,{
    id:"old",studentId:"resident-1",approve:true,verified:true,
  },now);
  assert.match(result.error??"",/newer registration/i);
  assert.equal(baseline.approved,0);

  result=await reviewTenantRegistration(baseline.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:false,
  },now);
  assert.ok(result.error);
  assert.equal(baseline.approved,0);

  result=await reviewTenantRegistration(baseline.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:true,
  },now);
  assert.ok(result.success,result.error);
  assert.equal(baseline.approved,1);
  assert.equal(baseline.hash,"hash-for-latest");
  assert.equal(baseline.rows.find(r=>r.id==="old")?.status,"SUPERSEDED");
  assert.equal(baseline.rows.find(r=>r.id==="old")?.passwordHash,null);
  assert.equal(baseline.rows.find(r=>r.id==="latest")?.status,"APPROVED");
  assert.equal(baseline.rows.find(r=>r.id==="latest")?.passwordHash,null);
  assert.equal(baseline.audits.length,1);
  assert.equal((baseline.audits[0].metadata as {supersededAttempts:number}).supersededAttempts,1);
  assert.equal(baseline.deletedTokens,1);
  result=await reviewTenantRegistration(baseline.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:true,
  },now);
  assert.ok(result.error);assert.equal(baseline.approved,1);

  const conflict=fixture({includeConflict:true});
  result=await reviewTenantRegistration(conflict.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:true,
  },now);
  assert.match(result.error??"",/different names or rooms/i);
  assert.equal(conflict.approved,0);
  result=await reviewTenantRegistration(conflict.db,owner,{
    id:"conflict",studentId:"",approve:false,verified:false,
    rejectionReason:"CONFLICTING_REQUEST",reviewNote:"Different registered name and room.",
  },now);
  assert.ok(result.success,result.error);
  assert.equal(conflict.rows.find(r=>r.id==="conflict")?.status,"REJECTED");
  assert.equal(conflict.rows.find(r=>r.id==="conflict")?.passwordHash,null);
  result=await reviewTenantRegistration(conflict.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:true,
  },now);
  assert.ok(result.success,result.error);
  assert.equal(conflict.approved,1);

  const unknown=fixture({noStudent:true});
  result=await reviewTenantRegistration(unknown.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:true,
  },now);
  assert.ok(result.error);assert.equal(unknown.approved,0);

  const cross=fixture({wrongOrganization:true});
  result=await reviewTenantRegistration(cross.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:true,
  },now);
  assert.ok(result.error);assert.equal(cross.approved,0);

  const missingReason=fixture();
  result=await reviewTenantRegistration(missingReason.db,owner,{
    id:"latest",studentId:"",approve:false,verified:false,
  },now);
  assert.ok(result.error);assert.equal(missingReason.audits.length,0);
  console.log("Tenant registration approval queue: deduplication, newest password, conflicting phone, account isolation, audit and reject reasons passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
