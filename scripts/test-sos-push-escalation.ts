import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {SOS_PUSH_WINDOW_MS,sosPushStages} from "../src/lib/sos-push-policy";

const sos={status:"OPEN",createdAt:new Date("2026-10-17T08:00:00Z")};
const at=(min:number)=>new Date(sos.createdAt.getTime()+min*60000);
test("only unacknowledged recent incidents get bounded escalation to owner/admin",()=>{
 assert.deepEqual(sosPushStages(sos,"CARETAKER",at(0)),["INITIAL"]);
 assert.deepEqual(sosPushStages(sos,"CARETAKER",at(16)),["INITIAL"]);
 assert.deepEqual(sosPushStages(sos,"MANAGER",at(16)),["INITIAL"]);
 assert.deepEqual(sosPushStages(sos,"OWNER",at(5)),["INITIAL","ESCALATE_5"]);
 assert.deepEqual(sosPushStages(sos,"ADMIN",at(15)),["INITIAL","ESCALATE_5","ESCALATE_15"]);
 for(const status of ["ACKNOWLEDGED","CLOSED"])
   assert.deepEqual(sosPushStages({...sos,status},"OWNER",at(16)),[]);
 assert.deepEqual(sosPushStages(sos,"OWNER",at(-1)),[]);
 assert.deepEqual(sosPushStages(sos,"OWNER",at(24*60)),[]);
 assert.equal(SOS_PUSH_WINDOW_MS,24*60*60000);
});
test("SOS push is sanitized on the phone lock screen and only opens known route",async()=>{
 const events:Record<string,(event:any)=>void>={};
 let notice:any[]=[],opened:string|null=null,waited:Promise<unknown>|undefined;
 runInNewContext(readFileSync("public/hostel-sw.js","utf8"),{
   URL,Response,fetch,
   self:{location:{origin:"https://hostel.test"},registration:{
     showNotification:async(...args:unknown[])=>{notice=args;},
   },clients:{matchAll:async()=>[],openWindow:async(url:string)=>{opened=url;}},
   addEventListener:(name:string,fn:(e:unknown)=>void)=>{events[name]=fn;}}
 });
 events.push({data:{json:()=>({kind:"SOS_ALERT",url:"/safety",tag:"sos-123",
   title:"SECRET PERSON",body:"SECRET COORDINATES"})},waitUntil:(p:Promise<unknown>)=>{waited=p;}});
 await waited;
 assert.match(JSON.stringify(notice),/Urgent hostel SOS/);
 assert.doesNotMatch(JSON.stringify(notice),/SECRET PERSON|SECRET COORDINATES/);
 events.notificationclick({notification:{close(){},data:{url:"/safety"}},
   waitUntil:(p:Promise<unknown>)=>{waited=p;}});
 await waited;assert.equal(opened,"/safety");
});
test("worker filters hostel scope, cancels stale jobs and prioritizes SOS",()=>{
 const source=readFileSync("src/lib/push-service.ts","utf8");
 assert.match(source,/organizationId:sub.organizationId,status:"OPEN"/);
 assert.match(source,/organizationId:job.subscription.organizationId,status:"OPEN"/);
 assert.match(source,/sosPushStages\(incident,responder\?\.role,now\)/);
 assert.match(source,/kind:"SOS_ALERT"/);
 assert.match(source,/const urgentJobs=await db.pushDelivery.findMany/);
 assert.match(source,/targetUrl:"\/safety"/);
 assert.match(source,/sos\|\|drill\?300:3600/);
 assert.doesNotMatch(source,/latitude:alert|longitude:alert|note:alert/);
});
