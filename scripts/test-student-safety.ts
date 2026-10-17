import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { TenantSession } from "../src/lib/auth/tenant-session";
import type { SessionPayload } from "../src/lib/auth/session";
import { submitSOS, updateSOS, availableSOSLocation } from "../src/lib/student-safety";

const now=new Date("2026-10-17T08:00:00Z");
const tenant:TenantSession={organizationId:"hostel-A",studentId:"student-A",name:"Resident",sessionVersion:1};
const staff:SessionPayload={organizationId:"hostel-A",userId:"staff-A",name:"Owner",role:"OWNER",sessionVersion:1};
const input={
 requestId:"c0fccb6e-b453-48a3-9136-3fa9c4b2fc6a",
 note:"Please send help",shareLocation:true,latitude:-1.1667,
 longitude:37.0178,accuracyMeters:29,
};

function fixture(options:{
 enabled?:boolean;staffRole?:"OWNER"|"ADMIN"|"MANAGER"|"CARETAKER";
 duplicate?:boolean;activeRecent?:boolean;overLimit?:boolean;rooms?:number;
 existing?:boolean;
}={}){
 const alerts:any[]=[],audit:any[]=[];
 const room={number:"54",propertyId:"property-A"};
 const recorded={id:"incident-1",organizationId:"hostel-A",status:"OPEN",
  latitude:-1.16,longitude:37.01,accuracyMeters:30,locationSharedAt:now};
 const tx={
  $queryRaw:async()=>[],
  student:{findFirst:async({where}:any)=>{
    assert.equal(where.organizationId,"hostel-A");
    return options.enabled===false?null:{id:"student-A",portalSessionVersion:1};
  }},
  user:{findFirst:async({where}:any)=>{
    assert.equal(where.organizationId,"hostel-A");
    return {id:"staff-A",role:options.staffRole??"OWNER",sessionVersion:1};
  }},
  occupancy:{findMany:async({where}:any)=>{
    assert.equal(where.organizationId,"hostel-A");
    return Array.from({length:options.rooms??1},()=>({room}));
  }},
  safetyAlert:{
    findUnique:async({where}:any)=>{
      assert.equal(where.organizationId_studentId_requestId.organizationId,"hostel-A");
      return options.duplicate?{id:"prior"}:null;
    },
    findFirst:async({where}:any)=>{
      assert.equal(where.organizationId,"hostel-A");
      if(where.id) return options.existing===false?null:recorded;
      return options.activeRecent?{id:"already-active"}:null;
    },
    count:async()=>options.overLimit?10:0,
    create:async({data}:any)=>{alerts.push(data);return{id:"sos-created"}},
    update:async({where,data}:any)=>{
      assert.equal(where.id,"incident-1");Object.assign(recorded,data);return{};
    },
  },
  auditLog:{create:async({data}:any)=>{audit.push(data);return{};}},
 };
 const db={$transaction:async(fn:(tx:typeof tx)=>unknown)=>fn(tx)} as unknown as PrismaClient;
 return {db,alerts,audit,recorded};
}

test("only active, signed-in residents may create SOS incidents",async()=>{
 const f=fixture();
 assert.match((await submitSOS(f.db,null,input,now)).error??"",/Sign in/);
 assert.equal(f.alerts.length,0);
 const d=fixture({enabled:false});
 assert.match((await submitSOS(d.db,tenant,input,now)).error??"",/not eligible/);
 assert.equal(d.alerts.length,0);
});

test("valid explicit location can be recorded once with the resident identity and hostel scope",async()=>{
 const f=fixture();
 const r=await submitSOS(f.db,tenant,input,now);
 assert.match(r.success??"",/SOS recorded/);
 assert.equal(f.alerts.length,1);
 const data=f.alerts[0];
 assert.equal(data.organizationId,"hostel-A");
 assert.equal(data.studentId,"student-A");
 assert.equal(data.propertyId,"property-A");
 assert.equal(data.latitude,input.latitude);
 assert.equal(data.locationSharedAt,now);
 assert.equal(f.audit[0].action,"STUDENT_SOS_CREATED");
 assert.equal(f.audit[0].metadata.locationShared,true);
 assert.ok(!JSON.stringify(f.audit).includes(input.latitude.toString()),"Precise location should never enter audit metadata");
});

test("SOS without location is still saved and never guesses coordinates",async()=>{
 const f=fixture();
 const r=await submitSOS(f.db,tenant,{...input,shareLocation:false,latitude:null,longitude:null,accuracyMeters:null},now);
 assert.ok(r.success);
 assert.equal(f.alerts[0].latitude,null);
 assert.equal(f.audit[0].metadata.locationShared,false);
});

test("unconsented location, partial pair and unsafe coordinates are rejected",async()=>{
 const f=fixture();
 for(const item of [
  {...input,shareLocation:false},
  {...input,longitude:null},
  {...input,latitude:91},
  {...input,longitude:181},
  {...input,accuracyMeters:-1},
 ]) {
  assert.ok((await submitSOS(f.db,tenant,item,now)).error);
 }
 assert.equal(f.alerts.length,0);
});

test("duplicate and recent active incidents do not create unsafe repeated SOS rows",async()=>{
 for(const options of [{duplicate:true},{activeRecent:true}]){
  const f=fixture(options);
  assert.ok((await submitSOS(f.db,tenant,input,now)).success);
  assert.equal(f.alerts.length,0);
 }
 const limited=fixture({overLimit:true});
 assert.match((await submitSOS(limited.db,tenant,input,now)).error??"",/rate limit/);
 assert.equal(limited.alerts.length,0);
});
test("ambiguous room association blocks creation rather than guessing the hostel property",async()=>{
 const f=fixture({rooms:2});
 assert.match((await submitSOS(f.db,tenant,input,now)).error??"",/room record/);
 assert.equal(f.alerts.length,0);
});

test("staff response requires confirmation and a real note; only management closes",async()=>{
 const f=fixture();
 assert.match((await updateSOS(f.db,staff,{id:"incident-1",decision:"ACKNOWLEDGE",verified:false,note:"Phone call made"},now)).error??"",/confirm/);
 assert.equal(f.audit.length,0);
 assert.ok((await updateSOS(f.db,staff,{id:"incident-1",decision:"ACKNOWLEDGE",verified:true,note:"I called student"},now)).success);
 assert.equal(f.recorded.status,"ACKNOWLEDGED");
 assert.equal(f.audit[0].action,"STUDENT_SOS_ACKNOWLEDGED");
 const gate=fixture({staffRole:"CARETAKER"});
 assert.match((await updateSOS(gate.db,{...staff,role:"CARETAKER"},{id:"incident-1",decision:"CLOSE",verified:true,note:"Contacted student"},now)).error??"",/Owner\/Admin/);
 assert.equal(gate.audit.length,0);
});
test("management close clears precise location and never certifies rescue",async()=>{
 const f=fixture();
 const r=await updateSOS(f.db,staff,{id:"incident-1",decision:"CLOSE",verified:true,note:"Spoke with student and documented steps"},now);
 assert.match(r.success??"",/does not certify/);
 assert.equal(f.recorded.status,"CLOSED");
 assert.equal(f.recorded.latitude,null);
 assert.equal(f.recorded.longitude,null);
 assert.equal(f.recorded.locationSharedAt,null);
 assert.equal(f.audit[0].action,"STUDENT_SOS_CLOSED");
});

test("map is displayed only during active opted-in and recent SOS",()=>{
 const item={status:"OPEN",latitude:-1.1667,longitude:37.0178,
  accuracyMeters:20,locationSharedAt:now};
 const loc=availableSOSLocation(item,new Date(now.getTime()+5000));
 assert.match(loc?.mapUrl??"",/^https:\/\/www\.google\.com\/maps\?q=/);
 assert.equal(availableSOSLocation(item,new Date(now.getTime()+31*60000)),null);
 assert.equal(availableSOSLocation({...item,status:"CLOSED"},now),null);
 assert.equal(availableSOSLocation({...item,latitude:null},now),null);
 assert.equal(availableSOSLocation({...item,longitude:1000},now),null);
});

test("student and staff screens disclose location choice and do not claim delivery",()=>{
 const student=readFileSync("src/components/student-sos-button.tsx","utf8");
 const staffPage=readFileSync("src/app/(app)/safety/page.tsx","utf8");
 const tenantPage=readFileSync("src/app/tenant/safety/page.tsx","utf8");
 assert.match(student,/Share my current location/);
 assert.match(student,/SOS — I NEED HELP/);
 assert.match(student,/getCurrentPosition/);
 assert.doesNotMatch(student,/watchPosition/);
 assert.match(student,/tel:999/);
 assert.match(student,/tel:112/);
 assert.match(staffPage,/availableSOSLocation/);
 assert.match(staffPage,/residentStaff/);
 assert.match(staffPage,/SafetyResponseForm/);
 assert.match(tenantPage,/residentTenant/);
 const login=readFileSync("src/app/tenant/login/page.tsx","utf8");
 assert.match(login,/You do not need a hostel account to make a phone call/);
});
