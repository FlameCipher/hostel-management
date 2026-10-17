import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import type {PrismaClient} from "../src/generated/prisma/client";
import {requestSafetyPushTest} from "../src/lib/sos-device-test";

process.env.VAPID_PUBLIC_KEY="test-public";
process.env.VAPID_PRIVATE_KEY="test-private";
process.env.VAPID_SUBJECT="mailto:test@example.com";
const now=new Date("2026-10-17T08:30:00Z");
const session={organizationId:"hostel-A",userId:"staff-1",name:"Staff",
 role:"OWNER" as const,sessionVersion:2};
function fixture({role="OWNER",allowed=true,recent=0,enabled=true}:{
 role?:string;allowed?:boolean;recent?:number;enabled?:boolean
}={}){
 const records:any[]=[];
 const sub={id:"device-1",organizationId:"hostel-A",accountId:"staff-1",
 audience:"staff",sessionVersion:2,host:"hostel-a.example",enabled};
 const db={
  user:{findFirst:async({where}:any)=>{
   if(where.organizationId!=="hostel-A"||!allowed)return null;
   return{id:"staff-1",role,sessionVersion:2};
  }},
  property:{findFirst:async({where}:any)=>{
   assert.equal(where.organizationId,"hostel-A");
   return{id:"hostel-property"};
  }},
  pushSubscription:{findFirst:async({where}:any)=>{
   if(!Object.entries(where).every(([k,v])=>(sub as any)[k]===v))return null;
   return sub;
  }},
  pushDelivery:{
   count:async({where}:any)=>{
    assert.equal(where.subscriptionId,"device-1");
    assert.equal(where.kind,"SOS_DRILL");
    return recent;
   },
   create:async({data}:any)=>{records.push(data);return data;}
  }
 };
 return {db:db as unknown as PrismaClient,records};
}
test("only a valid own-hostel authenticated staff device can enqueue a drill",async()=>{
 const f=fixture();
 const result=await requestSafetyPushTest(f.db,session,"device-1","hostel-a.example",now);
 assert.match(result.success??"",/TEST notification queued/);
 assert.equal(f.records.length,1);
 assert.equal(f.records[0].kind,"SOS_DRILL");
 assert.equal(f.records[0].subjectId,undefined);
 assert.equal(f.records[0].expiresAt.toISOString(),"2026-10-17T08:45:00.000Z");
 assert.equal(f.records[0].targetUrl,"/safety");
});
test("no account, wrong hostel/host/device, revoked staff or opt-out fails closed",async()=>{
 const f=fixture();
 const variants:[[any,any,any]]|any[]=[
  [null,"device-1","hostel-a.example"],
  [{...session,organizationId:"other"},"device-1","hostel-a.example"],
  [{...session,userId:"intruder"},"device-1","hostel-a.example"],
  [session,"other-device","hostel-a.example"],
  [session,"device-1","other-hostel.example"],
  [session,"device-1",null],
  [session,null,"hostel-a.example"],
 ];
 for(const [s,d,h] of variants){
   const response=await requestSafetyPushTest(f.db,s,d,h,now);
   assert.ok(response.error);
 }
 assert.equal(f.records.length,0);
 const invalid=fixture({allowed:false});
 assert.ok((await requestSafetyPushTest(invalid.db,session,"device-1","hostel-a.example",now)).error);
 const unsub=fixture({enabled:false});
 assert.ok((await requestSafetyPushTest(unsub.db,session,"device-1","hostel-a.example",now)).error);
});
test("rate limits a device; no forced test to another subscriber",async()=>{
 const f=fixture({recent:1});
 assert.match((await requestSafetyPushTest(f.db,session,"device-1","hostel-a.example",now)).error??"",/ten minutes/);
 assert.equal(f.records.length,0);
});
test("service worker clearly marks the drill TEST without exposing supplied identity",async()=>{
 const events:Record<string,(event:any)=>void>={};
 let shown:any[]=[],opened:string|null=null,waited:Promise<unknown>|undefined;
 runInNewContext(readFileSync("public/hostel-sw.js","utf8"),{
   URL,Response,fetch,
   self:{location:{origin:"https://hostel.example"},
    registration:{showNotification:async(...args:unknown[])=>{shown=args;}},
    clients:{matchAll:async()=>[],openWindow:async(u:string)=>{opened=u;}},
    addEventListener:(name:string,fn:(e:unknown)=>void)=>{events[name]=fn;}}
 });
 events.push({data:{json:()=>({kind:"SOS_DRILL",url:"/safety",tag:"test-1",
    title:"Private student",body:"Precise coordinates"})},waitUntil:(p:Promise<unknown>)=>{waited=p;}});
 await waited;
 const text=JSON.stringify(shown);
 assert.match(text,/Hostel notification TEST/);
 assert.match(text,/not.*real|only.*test|only a notification test/i);
 assert.doesNotMatch(text,/Private student|Precise coordinates|Urgent hostel SOS/);
 events.notificationclick({notification:{close(){},data:{url:"/safety"}},
   waitUntil:(p:Promise<unknown>)=>{waited=p;}});
 await waited;assert.equal(opened,"/safety");
});
test("route enforces origin, active staff host and device-cookie self scope",()=>{
 const api=readFileSync("src/app/api/push/safety-test/route.ts","utf8");
 const page=readFileSync("src/app/(app)/safety/page.tsx","utf8");
 assert.match(api,/sameOrigin\(request\)/);
 assert.match(api,/getSession\(\)/);
 assert.match(api,/context\.property\?\.organizationId!==session\.organizationId/);
 assert.match(api,/context\.property\.customDomain!==context\.host/);
 assert.match(api,/hostel_push_device/);
 assert.match(page,/SafetyPushSelfTest/);
 assert.doesNotMatch(api,/safetyAlert\.(?:create|update|delete)/);
});
