import assert from "node:assert/strict";
import type {PrismaClient} from "../src/generated/prisma/client";
import type {TenantSession} from "../src/lib/auth/tenant-session";
import {requestVisit} from "../src/lib/visitors";

const now=new Date("2026-10-12T08:00:00Z");
const resident:TenantSession={
  studentId:"resident-1",organizationId:"hostel-A",name:"Resident One",sessionVersion:0,
};
const input={
  requestId:"f94b3a06-ab96-4515-a8b6-2b4d88bd4988",
  occupancyId:"stay-1",
  visitorName:"Guest One",
  visitorPhone:"+254 712 345 678",
  purpose:"Family visit",
  vehicle:"",
  arrival:"2026-10-12T12:00",
  departure:"2026-10-12T14:00",
};
function fixture(options?:{duplicate?:boolean;disabled?:boolean;occupied?:boolean;overlap?:boolean;invalidProperty?:boolean;dailyCount?:number}){
  const writes:Record<string,unknown>[]=[];
  const audits:Record<string,unknown>[]=[];
  let saved:Record<string,unknown>|null=null;
  const tx={
    $queryRaw:async()=>[],
    student:{findFirst:async({where}:{where:{organizationId:string}})=>{
      assert.equal(where.organizationId,"hostel-A");
      return options?.disabled?null:{id:"resident-1",portalSessionVersion:0};
    }},
    visitorRequest:{
      findUnique:async()=>options?.duplicate?{id:"existing"}:saved,
      count:async()=>options?.dailyCount??0,
      findFirst:async({where}:{where:Record<string,unknown>})=>{
        assert.equal(where.organizationId,"hostel-A");
        assert.equal(where.propertyId,"property-A");
        assert.equal(where.studentId,"resident-1");
        assert.equal(where.visitorPhone,"254712345678");
        assert.deepEqual(where.status,{in:["REQUESTED","APPROVED","CHECKED_IN"]});
        return options?.overlap?{id:"other-visit"}:null;
      },
      create:async({data}:{data:Record<string,unknown>})=>{
        assert.equal(data.organizationId,"hostel-A");
        assert.equal(data.propertyId,"property-A");
        writes.push(data);
        saved={id:"visit-1",...data};
        return saved;
      },
    },
    occupancy:{
      findFirst:async({where}:{where:{organizationId:string;studentId:string}})=>{
        assert.equal(where.organizationId,"hostel-A");
        assert.equal(where.studentId,"resident-1");
        return options?.occupied===false?null:{
          id:"stay-1",room:{number:"24",property:{
            id:"property-A",organizationId:options?.invalidProperty?"hostel-B":"hostel-A",
            countryCode:"KE",timeZone:"Africa/Nairobi",
          }},
        };
      },
    },
    auditLog:{create:async({data}:{data:Record<string,unknown>})=>{audits.push(data);return {};}},
  };
  const db={
    $transaction:async(fn:(client:typeof tx)=>Promise<unknown>)=>fn(tx),
  } as unknown as PrismaClient;
  return {db,writes,audits};
}
async function run(){
  const active=fixture();
  let r=await requestVisit(active.db,resident,input,now);
  assert.ok(r.success,r.error);
  assert.equal(active.writes.length,1);
  assert.equal(active.writes[0].visitorPhone,"254712345678");
  assert.equal(active.writes[0].roomLabel,"24");
  assert.equal((active.writes[0].expectedArrival as Date).toISOString(),"2026-10-12T09:00:00.000Z");
  assert.equal(active.audits.length,1);
  const duplicate=await requestVisit(active.db,resident,input,now);
  assert.ok(duplicate.success);
  assert.equal(active.writes.length,1);
  const overlap=fixture({overlap:true});
  r=await requestVisit(overlap.db,resident,{...input,requestId:"ee074abc-f0a0-4be0-810b-71c7ab8e6121"},now);
  assert.match(r.error??"",/already overlaps/i);assert.equal(overlap.writes.length,0);
  const inactive=fixture({disabled:true});
  r=await requestVisit(inactive.db,resident,input,now);
  assert.ok(r.error);assert.equal(inactive.writes.length,0);
  const moved=fixture({occupied:false});
  r=await requestVisit(moved.db,resident,input,now);
  assert.ok(r.error);assert.equal(moved.writes.length,0);
  const limits=fixture({dailyCount:20});
  r=await requestVisit(limits.db,resident,input,now);
  assert.match(r.error??"",/Daily visitor request limit/i);assert.equal(limits.writes.length,0);
  const noTime=fixture();
  r=await requestVisit(noTime.db,resident,{...input,arrival:"2026-02-30T14:00"},now);
  assert.ok(r.error);assert.equal(noTime.writes.length,0);
  const noSession=fixture();
  r=await requestVisit(noSession.db,null,input,now);
  assert.ok(r.error);assert.equal(noSession.writes.length,0);
  console.log("Tenant visitor request workflow: organization isolation, duplicate submit, overlap, occupancy, rate and time checks passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
