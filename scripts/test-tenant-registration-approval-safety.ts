import assert from "node:assert/strict";
import type {PrismaClient} from "../src/generated/prisma/client";
import type {SessionPayload} from "../src/lib/auth/session";
import {reviewTenantRegistration} from "../src/lib/tenant-registration";

const now=new Date("2026-10-16T10:00:00.000Z");
const date=(v:string)=>new Date(v);
type Request={
  id:string;organizationId:string;propertyId:string;
  fullName:string;phone:string;roomNumber:string;
  createdAt:Date;expiresAt:Date;status:string;
  studentId:string|null;passwordHash:string|null;
  reviewedById:string|null;reviewedAt:Date|null;
};
function make(id:string,createdAt:string,overrides:Partial<Request>={}):Request {
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
const conflicts=make("conflict","2026-10-14T14:00:00Z",{
  fullName:"Not Resident One",roomNumber:"60",
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
  const db={$transaction:async(fn:(client:typeof tx)=>Promise<unknown>)=>fn(tx)} as unknown as PrismaClient;
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
    id:"old",studentId:"resident-1",approve:true,verified:true,verificationMethod:"IN_PERSON",
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
  assert.match(result.error??"",/choose how identity was independently verified/i);
  assert.equal(baseline.approved,0);
  assert.equal(baseline.audits.length,0);


  result=await reviewTenantRegistration(baseline.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:true,verificationMethod:"IN_PERSON",
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
  assert.equal((baseline.audits[0].metadata as {verificationMethod:string}).verificationMethod,"IN_PERSON");

  assert.equal(baseline.deletedTokens,1);
  result=await reviewTenantRegistration(baseline.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:true,verificationMethod:"IN_PERSON",
  },now);
  assert.ok(result.error);assert.equal(baseline.approved,1);

  const conflict=fixture({includeConflict:true});
  result=await reviewTenantRegistration(conflict.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:true,verificationMethod:"IN_PERSON",
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
    id:"latest",studentId:"resident-1",approve:true,verified:true,verificationMethod:"IN_PERSON",
  },now);
  assert.ok(result.success,result.error);
  assert.equal(conflict.approved,1);

  const unknown=fixture({noStudent:true});
  result=await reviewTenantRegistration(unknown.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:true,verificationMethod:"IN_PERSON",
  },now);
  assert.ok(result.error);assert.equal(unknown.approved,0);

  const cross=fixture({wrongOrganization:true});
  result=await reviewTenantRegistration(cross.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:true,verificationMethod:"IN_PERSON",
  },now);
  assert.ok(result.error);assert.equal(cross.approved,0);

  const rejectedLatest=fixture();
  result=await reviewTenantRegistration(rejectedLatest.db,owner,{
    id:"latest",studentId:"",approve:false,verified:false,
    rejectionReason:"DUPLICATE",reviewNote:"Student should submit a fresh verified request.",
  },now);
  assert.ok(result.success,result.error);
  assert.equal(rejectedLatest.rows.find(r=>r.id==="latest")?.status,"REJECTED");
  assert.equal(rejectedLatest.rows.find(r=>r.id==="old")?.status,"SUPERSEDED");
  assert.equal(rejectedLatest.rows.find(r=>r.id==="old")?.passwordHash,null);
  assert.equal(rejectedLatest.approved,0);
  assert.equal((rejectedLatest.audits[0].metadata as {supersededAttempts:number}).supersededAttempts,1);
  const viaPhone=fixture();
  result=await reviewTenantRegistration(viaPhone.db,owner,{
    id:"latest",studentId:"resident-1",approve:true,verified:true,
    verificationMethod:"CALL_REGISTERED_PHONE",
  },now);
  assert.ok(result.success,result.error);
  assert.equal((viaPhone.audits[0].metadata as {verificationMethod:string}).verificationMethod,"CALL_REGISTERED_PHONE");
  const missingReason=fixture();
  result=await reviewTenantRegistration(missingReason.db,owner,{
    id:"latest",studentId:"",approve:false,verified:false,
  },now);
  assert.ok(result.error);assert.equal(missingReason.audits.length,0);
  console.log("Tenant registration approval queue: deduplication, newest password, conflicting phone, account isolation, audit and reject reasons passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
