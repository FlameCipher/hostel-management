import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
 EMERGENCY_CALL_TEST_AUDIT_ACTION,recordEmergencyCallTest,latestEmergencyCallTests
} from "../src/lib/emergency-call-acceptance";
import { callTestLabels } from "../src/lib/emergency-call-acceptance-policy";

const owner={userId:"owner-1",name:"Owner",role:"OWNER" as const,
 organizationId:"mama-mbugua-hostel",sessionVersion:2};
const original={line:"0",result:"ANSWERED",note:"Spoke to authorized caretaker on the line.",personallyTested:true};
function setup(options:{role?:"OWNER"|"ADMIN"|"MANAGER"|"CARETAKER";revoked?:boolean}={}){
 const audit:any[]=[];
 const tx={
  $queryRaw:async()=>[],
  user:{findFirst:async({where}:any)=>{
   assert.equal(where.organizationId,"mama-mbugua-hostel");
   assert.equal(where.id,"owner-1");
   return options.revoked?null:{id:"owner-1",role:options.role??"OWNER",sessionVersion:2};
  }},
  auditLog:{create:async({data}:any)=>{audit.push(data);return {id:"log1",createdAt:new Date()};}},
 };
 const db={$transaction:async(fn:(tx:unknown)=>unknown)=>fn(tx)} as unknown as PrismaClient;
 return {db,audit};
}
test("only owner/admin can record an actual, attested MMAMBUGUA call result",async()=>{
 for(const role of ["OWNER","ADMIN"] as const){
  const f=setup({role});
  const r=await recordEmergencyCallTest(f.db,{...owner,role},original);
  assert.match(r.success??"",/staff self-reported|self-reported/i);
  assert.equal(f.audit.length,1);
  assert.equal(f.audit[0].organizationId,"mama-mbugua-hostel");
  assert.equal(f.audit[0].actorUserId,"owner-1");
  assert.equal(f.audit[0].action,EMERGENCY_CALL_TEST_AUDIT_ACTION);
  assert.equal(f.audit[0].entityId,"mama-mbugua-hostel");
  assert.deepEqual(f.audit[0].metadata,{line:0,result:"ANSWERED",note:original.note,personallyTested:true});
 }
});
test("revoked staff, manager and caretaker cannot save emergency test claims",async()=>{
 for(const opts of [{role:"MANAGER" as const},{role:"CARETAKER" as const},{revoked:true}]){
  const f=setup(opts);
  const r=await recordEmergencyCallTest(f.db,owner,original);
  assert.ok(r.error);assert.equal(f.audit.length,0);
 }
});
test("non-MMAMBUGUA and unsigned sessions never write call records",async()=>{
 const f=setup();
 for(const claims of [null,{...owner,organizationId:"different-hostel"}]){
  const r=await recordEmergencyCallTest(f.db,claims,original);
  assert.ok(r.error);
 }
 assert.equal(f.audit.length,0);
});
test("cannot mark a phone answered without personally confirming an actual call",async()=>{
 const f=setup();
 for(const item of [
  {...original,personallyTested:false},
  {...original,personallyTested:undefined},
  {...original,line:""},
  {...original,line:"2"},
  {...original,result:"AUTO_CONFIRMED"},
  {...original,note:"short"},
  {...original,note:"x".repeat(281)}
 ]){
  const r=await recordEmergencyCallTest(f.db,owner,item);
  assert.ok(r.error);
 }
 assert.equal(f.audit.length,0);
});
test("unanswered and failed calls are reportable, never auto-assumed successful",async()=>{
 const f=setup();
 for(const result of ["NO_ANSWER","WRONG_RECIPIENT","FAILED_TO_CONNECT"]){
  const r=await recordEmergencyCallTest(f.db,owner,{...original,line:"1",result});
  assert.ok(r.success);assert.match(callTestLabels[result as keyof typeof callTestLabels],/not|nobody|Could not/i);
 }
 assert.equal(f.audit.length,3);
 assert.ok(f.audit.every(a=>a.metadata.line===1));
});
test("latest staff-reported result is selected for each phone and history is never treated as independent proof",()=>{
 const now=new Date("2026-10-17T09:00:00Z"),old=new Date("2026-10-16T08:00:00Z");
 const items=[
  {createdAt:now,actor:{name:"Admin"},metadata:{line:0,result:"NO_ANSWER",note:"No one answered after calling."}},
  {createdAt:now,actor:{name:"Owner"},metadata:{line:1,result:"ANSWERED",note:"Verified responder answered this time."}},
  {createdAt:old,actor:{name:"Old reviewer"},metadata:{line:0,result:"ANSWERED",note:"Earlier call was answered by staff."}},
  {createdAt:old,actor:null,metadata:{line:5,result:"ANSWERED",note:"wrong line"}},
 ];
 const latest=latestEmergencyCallTests(items);
 assert.equal(latest.length,2);
 assert.equal(latest[0].result,"NO_ANSWER");
 assert.equal(latest[0].testedBy,"Admin");
 assert.equal(latest[1].line,1);
 assert.equal(latest[1].result,"ANSWERED");
});
test("gate-readiness links actual call form, no automatic call/GPS/SOS activation",()=>{
 const screen=readFileSync("src/app/(app)/gate-readiness/page.tsx","utf8");
 const client=readFileSync("src/components/emergency-call-acceptance.tsx","utf8");
 const action=readFileSync("src/app/(app)/gate-readiness/emergency-actions.ts","utf8");
 const backend=readFileSync("src/lib/emergency-call-acceptance.ts","utf8");
 assert.match(screen,/staffMayReviewGateReadiness\(session.role\)/);
 assert.match(screen,/MMAMBUGUA_EMERGENCY_ORGANIZATION_ID/);
 assert.match(screen,/latestEmergencyCallTests\(callRows\)/);
 assert.match(screen,/EmergencyCallAcceptance records=\{callTests\}/);
 assert.match(client,/personallyTested/);
 assert.match(client,/Call \{phone.display\} now/);
 assert.match(client,/not independent|not automatically|not a guarantee|not a verified|staff-reported|manually reported/i);
 assert.match(action,/requireSession\(\)/);
 assert.match(action,/recordEmergencyCallTest\(db,session/);
 assert.match(backend,/residentStaff\(tx,session\)/);
 for(const v of [screen,client,action,backend])
  assert.doesNotMatch(v,/HOSTEL_SOS_ENABLED\s*=|watchPosition\(|student\.update\(|payment\.create\(/);
});
