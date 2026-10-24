import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "../src/generated/prisma/client";
import { allowWhatsAppProviderTransition } from "../src/lib/whatsapp-webhook-status-policy";
import { recordWhatsAppStatus } from "../src/lib/whatsapp-cloud";

test("Meta callback status is monotonic and terminal failures cannot be accidentally resurrected",()=>{
 assert.equal(allowWhatsAppProviderTransition("ACCEPTED","SENT"),true);
 assert.equal(allowWhatsAppProviderTransition("SENT","DELIVERED"),true);
 assert.equal(allowWhatsAppProviderTransition("ACCEPTED","READ"),true);
 assert.equal(allowWhatsAppProviderTransition("DELIVERED","READ"),true);
 assert.equal(allowWhatsAppProviderTransition("SENT","FAILED"),true);
 for(const current of ["FAILED","CANCELLED","READ"]){
  for(const next of ["SENT","DELIVERED","FAILED"]){
   assert.equal(allowWhatsAppProviderTransition(current,next),false,`${current}->${next}`);
  }
 }
 for(const [current,next] of [["READ","READ"],["DELIVERED","SENT"],["SENT","ACCEPTED"],["FAILED","READ"],["QUEUED","SENT"],["REVIEW","SENT"],["ACCEPTED","ACCEPTED"]]){
  assert.equal(allowWhatsAppProviderTransition(current,next),false,`${current}->${next}`);
 }
 assert.equal(allowWhatsAppProviderTransition("DELIVERED","FAILED"),false);
 assert.equal(allowWhatsAppProviderTransition("ACCEPTED","FAILED"),true);
 assert.equal(allowWhatsAppProviderTransition("SENT","wrong"),false);
});

function fake(initialStatus:string){
 const row={id:"delivery-1",providerId:"wamid-123",phoneNumberId:"phone-id",recipient:"254726717120",
   status:initialStatus,deliveredAt:null as Date|null,readAt:null as Date|null,error:null as string|null};
 let updates=0;
 const tx={
  $queryRaw:async()=>[],
  whatsAppDelivery:{
   findFirst:async({where}:{where:{providerId:string;phoneNumberId:string;recipient:string}})=>
    where.providerId===row.providerId&&where.phoneNumberId===row.phoneNumberId&&where.recipient===row.recipient?{...row}:null,
   update:async({data}:{data:Partial<typeof row>})=>{Object.assign(row,data);updates++;return row;},
  },
 };
 const db={$transaction:async(f:(v:typeof tx)=>Promise<unknown>)=>f(tx)} as unknown as PrismaClient;
 return {row,db,get updates(){return updates;}};
}
const callback=(status:string,id="wamid-123",recipient="254726717120")=>({id,recipient_id:recipient,status});

test("signed callback sequence retains READ, rejects stale SENT and repeat failed messages",async()=>{
 const f=fake("ACCEPTED");
 await recordWhatsAppStatus(f.db,"phone-id",callback("sent"));
 assert.equal(f.row.status,"SENT");
 await recordWhatsAppStatus(f.db,"phone-id",callback("delivered"));
 assert.equal(f.row.status,"DELIVERED");
 const originalDelivery=f.row.deliveredAt;
 assert(originalDelivery instanceof Date);
 await recordWhatsAppStatus(f.db,"phone-id",callback("read"));
 assert.equal(f.row.status,"READ");
 assert.equal(f.row.deliveredAt,originalDelivery);
 const firstRead=f.row.readAt;
 assert(firstRead instanceof Date);
 for(const state of ["read","delivered","sent","failed"]){
  await recordWhatsAppStatus(f.db,"phone-id",callback(state));
 }
 assert.equal(f.row.status,"READ");
 assert.equal(f.row.readAt,firstRead);
 assert.equal(f.updates,3);
});
test("provider failure remains failed; later stale sent events cannot mark delivery successful",async()=>{
 const f=fake("ACCEPTED");
 await recordWhatsAppStatus(f.db,"phone-id",callback("failed"));
 assert.equal(f.row.status,"FAILED");
 assert.match(f.row.error??"",/Meta reported delivery failure/);
 for(const state of ["sent","read","failed"]){
  await recordWhatsAppStatus(f.db,"phone-id",callback(state));
 }
 assert.equal(f.row.status,"FAILED");
 assert.equal(f.updates,1);
});
test("recipient and phone mismatches never update another hostel's provider receipt",async()=>{
 const f=fake("SENT");
 for(const variant of [
  {phone:"other-meta-phone",status:callback("delivered")},
  {phone:"phone-id",status:callback("delivered","other-message")},
  {phone:"phone-id",status:callback("delivered","wamid-123","254700000000")},
 ])await recordWhatsAppStatus(f.db,variant.phone,variant.status);
 assert.equal(f.row.status,"SENT");
 assert.equal(f.updates,0);
});
test("actual callback handler remains authenticated and no provider send occurs",()=>{
 const route=readFileSync("src/app/api/whatsapp/webhook/route.ts","utf8");
 const cloud=readFileSync("src/lib/whatsapp-cloud.ts","utf8");
 assert.match(route,/webhookSignature\(raw,request.headers.get\("x-hub-signature-256"\)\)/);
 assert.match(route,/recordWhatsAppStatus\(db/);
 assert.match(cloud,/allowWhatsAppProviderTransition\(item.status,value\)/);
 assert.doesNotMatch(route,/sendWhatsAppTemplate\(/);
});
