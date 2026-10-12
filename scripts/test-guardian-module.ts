import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { SessionPayload } from "../src/lib/auth/session";
import {
  guardianCorrectionFingerprint, guardianPhoneCorrections,
  guardianContactSummary, guardianContactHref, uniqueCountry,
  type GuardianContactRecord,
} from "../src/lib/guardian-registry";
import { applyGuardianFormatCorrection } from "../src/lib/guardian-batch-cleanup";

const makeRecord=(id:string,phone:string):GuardianContactRecord=>({
  id,studentId:"student-"+id,phone,name:"Parent "+id,
  relationship:"Parent",email:null,
  student:{fullName:"Student "+id,status:"ACTIVE",admissionNumber:null},
});
const contacts=[
  makeRecord("g1","0712345678"),
  makeRecord("g2","0112345678"),
  makeRecord("g3","254712345678"),
  makeRecord("g4","+44 7700 900123"),
];
assert.equal(uniqueCountry([{countryCode:"KE"}]),"KE");
assert.equal(uniqueCountry([{countryCode:"KE"},{countryCode:"KE"}]),"KE");
assert.equal(uniqueCountry([{countryCode:"KE"},{countryCode:"GB"}]),null);
assert.equal(uniqueCountry([{countryCode:null}]),null);
assert.equal(uniqueCountry([]),null);

const corrections=guardianPhoneCorrections(contacts,"KE");
assert.deepEqual(corrections.map(c=>[c.id,c.previousPhone,c.newPhone]),[
  ["g1","0712345678","254712345678"],
  ["g2","0112345678","254112345678"],
]);
assert.equal(guardianPhoneCorrections(contacts,"GB").length,0);
assert.equal(guardianPhoneCorrections(contacts,null).length,0);
assert.equal(guardianPhoneCorrections(contacts,"KE").length,2);
const fingerprint=guardianCorrectionFingerprint(corrections);
assert.equal(fingerprint.length,64);
assert.equal(guardianCorrectionFingerprint([...corrections].reverse()),fingerprint);
assert.notEqual(guardianCorrectionFingerprint(corrections.slice(0,1)),fingerprint);

assert.equal(guardianContactHref("0712345678","KE").phoneHref,"tel:+254712345678");
assert.equal(guardianContactHref("0712345678","KE").whatsappHref,"https://wa.me/254712345678");
assert.equal(guardianContactHref("0712345678","GB").phoneHref,null);
const summary=guardianContactSummary(contacts,"KE",6);
assert.equal(summary.students,6);
assert.equal(summary.guardians,4);
assert.equal(summary.missingGuardians,2);
assert.equal(summary.formatCorrections,2);
assert.equal(summary.contactReady,4);
assert.equal(summary.missingEmail,4);

const owner:SessionPayload={
  userId:"owner",organizationId:"org-A",
  sessionVersion:4,role:"OWNER",name:"Owner",
};
type G={id:string;studentId:string;phone:string;organizationId:string};
function fixture(options?:{countries?:Array<string|null>; user?:boolean; version?:number; staleId?:string}) {
  let records:G[]=[
    {id:"g1",studentId:"student-g1",phone:"0712345678",organizationId:"org-A"},
    {id:"g2",studentId:"student-g2",phone:"0112345678",organizationId:"org-A"},
    {id:"other",studentId:"other-student",phone:"0712345678",organizationId:"org-B"},
  ];
  const events:Array<{data:Record<string,unknown>}>=[];
  let writes=0;
  const transaction={
    user:{findFirst:async()=>options?.user===false?null:{id:"owner",sessionVersion:options?.version??4}},
    property:{findMany:async()=> (options?.countries??["KE"]).map(countryCode=>({countryCode}))},
    guardian:{
      findMany:async({where}:{where:{student:{organizationId:string}}})=>{
        assert.equal(where.student.organizationId,"org-A");
        return records.filter(x=>x.organizationId==="org-A");
      },
      updateMany:async({where,data}:{where:{id:string;studentId:string;phone:string;student:{organizationId:string}};data:{phone:string}})=>{
        assert.equal(where.student.organizationId,"org-A");
        if(options?.staleId===where.id)return {count:0};
        const match=records.find(x=>x.id===where.id&&x.studentId===where.studentId&&
          x.phone===where.phone&&x.organizationId===where.student.organizationId);
        if(!match)return {count:0};
        match.phone=data.phone;
        writes++;
        return {count:1};
      },
    },
    auditLog:{create:async(record:{data:Record<string,unknown>})=>{events.push(record);return {};}},
  };
  const db={
    $transaction:async (callback:(tx:typeof transaction)=>Promise<unknown>,settings:unknown)=>{
      assert.equal((settings as {isolationLevel:string}).isolationLevel,"Serializable");
      const old=records.map(r=>({...r}));
      const previous=events.length;
      try{return await callback(transaction);}
      catch(error){
        records=old;events.length=previous;writes=0;
        throw error;
      }
    },
  } as unknown as PrismaClient;
  return {db,events,get writes(){return writes;},get records(){return records;}};
}
async function run(){
  const expected=guardianPhoneCorrections([
    {id:"g1",studentId:"student-g1",phone:"0712345678"},
    {id:"g2",studentId:"student-g2",phone:"0112345678"},
  ],"KE");
  const payload={count:expected.length,fingerprint:guardianCorrectionFingerprint(expected)};
  const active=fixture();
  assert.equal(await applyGuardianFormatCorrection(active.db,owner,payload),2);
  assert.equal(active.writes,2);
  assert.deepEqual(active.records.map(x=>x.phone),[
    "254712345678","254112345678","0712345678",
  ]);
  assert.equal(active.events.length,2);
  assert.ok(active.events.every(e=>e.data.action==="GUARDIAN_CONTACT_FORMAT_NORMALIZED"));
  assert.ok(active.events.every(e=>e.data.actorUserId==="owner"));
  assert.ok(active.events.every(e=>e.data.organizationId==="org-A"));
  assert.ok(!active.events.some(e=>JSON.stringify(e).includes("org-B")));
  await assert.rejects(()=>applyGuardianFormatCorrection(active.db,owner,payload),/REVIEW_CHANGED/);
  assert.equal(active.events.length,2);

  const stale=fixture({staleId:"g2"});
  await assert.rejects(()=>applyGuardianFormatCorrection(stale.db,owner,payload),/STALE_GUARDIAN/);
  assert.equal(stale.writes,0);
  assert.deepEqual(stale.records.filter(x=>x.organizationId==="org-A").map(x=>x.phone),
    ["0712345678","0112345678"]);
  assert.equal(stale.events.length,0);

  const inactive=fixture({user:false});
  await assert.rejects(()=>applyGuardianFormatCorrection(inactive.db,owner,payload),/ACCESS_CHANGED/);
  assert.equal(inactive.writes,0);
  const revoked=fixture({version:9});
  await assert.rejects(()=>applyGuardianFormatCorrection(revoked.db,owner,payload),/ACCESS_CHANGED/);
  assert.equal(revoked.writes,0);
  const mixed=fixture({countries:["KE","GB"]});
  await assert.rejects(()=>applyGuardianFormatCorrection(mixed.db,owner,payload),/COUNTRY_REVIEW_REQUIRED/);
  assert.equal(mixed.writes,0);
  const manager=fixture();
  await assert.rejects(()=>applyGuardianFormatCorrection(manager.db,{
    ...owner,role:"MANAGER",
  },payload),/ACCESS_CHANGED/);
  assert.equal(manager.writes,0);

  const drift=fixture();
  await assert.rejects(()=>applyGuardianFormatCorrection(drift.db,owner,{
    count:1,fingerprint:guardianCorrectionFingerprint(expected.slice(0,1)),
  }),/REVIEW_CHANGED/);
  assert.equal(drift.writes,0);
  console.log("Guardian module: contact preview, tenant isolation, approval, atomicity, idempotence and audit tests passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
