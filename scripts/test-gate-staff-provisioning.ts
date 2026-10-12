import assert from "node:assert/strict";
import type {PrismaClient} from "../src/generated/prisma/client";
import type {SessionPayload} from "../src/lib/auth/session";
import {saveHostelStaff} from "../src/lib/hostel-staff";

const input={
  name:"Authorized Gate Operator",
  email:"gate.operator@example.invalid",
  phone:"0712345678",
  role:"CARETAKER" as const,
  active:true,
  password:"example-temporary-private-password-1!",
};
const sessions=(role:SessionPayload["role"]):SessionPayload=>({
  userId:"actor-1",organizationId:"hostel-A",name:"Actor",role,sessionVersion:3,
});
function fixture(role:SessionPayload["role"],version=3) {
  const events:Array<{data:Record<string,unknown>}>=[];
  const writes:Array<Record<string,unknown>>=[];
  let locks=0;
  const tx={
    $queryRaw:async()=>{locks++;return[];},
    user:{
      findFirst:async(a:{where:{id?:string;email?:unknown}})=>{
        if(a.where.id==="actor-1")return {
          id:"actor-1",organizationId:"hostel-A",role,active:true,
          email:"actor@example.invalid",sessionVersion:version,
          organization:{status:"ACTIVE"},
        };
        return null;
      },
      create:async({data}:{data:Record<string,unknown>})=>{
        writes.push(data);
        return {id:"created-gate",...data};
      },
      count:async()=>1,
    },
    auditLog:{create:async(a:{data:Record<string,unknown>})=>{
      events.push(a);return{};
    }},
  };
  const db={
    $transaction:async(fn:(t:typeof tx)=>Promise<unknown>)=>fn(tx),
  } as unknown as PrismaClient;
  return {db,events,writes,get locks(){return locks;}};
}
async function run() {
  for(const role of ["CARETAKER","MANAGER"] as const){
    const f=fixture(role);
    const result=await saveHostelStaff(f.db,sessions(role),null,input,async()=>true);
    assert.equal(result.success,undefined);
    assert.match(result.error,/Owner|Admin|owner|admin/);
    assert.equal(f.writes.length,0);
    assert.equal(f.events.length,0);
  }
  const revoked=fixture("OWNER",9);
  const failed=await saveHostelStaff(revoked.db,sessions("OWNER"),null,input,async()=>true);
  assert.equal(failed.success,undefined);
  assert.equal(revoked.writes.length,0);

  const foreign=fixture("OWNER");
  const foreignUser=await saveHostelStaff(foreign.db,{
    ...sessions("OWNER"),organizationId:"hostel-B",
  },null,input,async()=>false);
  assert.equal(foreignUser.success,undefined);
  assert.equal(foreign.writes.length,0);

  const ready=fixture("OWNER");
  const saved=await saveHostelStaff(ready.db,sessions("OWNER"),null,input,async()=>true);
  assert.equal(saved.success,true);
  assert.equal(ready.writes.length,1);
  assert.equal(ready.writes[0].organizationId,"hostel-A");
  assert.equal(ready.writes[0].role,"CARETAKER");
  assert.equal(ready.writes[0].email,"gate.operator@example.invalid");
  assert.equal(ready.writes[0].active,true);
  assert.equal(typeof ready.writes[0].passwordHash,"string");
  assert.notEqual(ready.writes[0].passwordHash,input.password);
  assert.ok((ready.writes[0].passwordHash as string).startsWith("$2"));
  assert.equal(ready.events.length,1);
  assert.equal(ready.events[0].data.action,"STAFF_ACCOUNT_CREATED");
  assert.equal(ready.events[0].data.actorUserId,"actor-1");
  assert.equal(ready.events[0].data.organizationId,"hostel-A");
  assert.equal((ready.events[0].data.metadata as {role:string}).role,"CARETAKER");
  assert.ok(ready.locks>=2);

  const missingName=fixture("OWNER");
  const rejected=await saveHostelStaff(missingName.db,sessions("OWNER"),null,{
    ...input,name:"",password:"password-not-sent",
  },async()=>true);
  assert.equal(rejected.success,undefined);
  assert.equal(missingName.writes.length,0);
  console.log("Gate staff onboarding: explicit owner role, active sessions, isolated employee credentials, audit and no auto-provisioning passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
