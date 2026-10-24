import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "../src/generated/prisma/client";
import { approvedSingleBodyTemplate, verifiedHostelSender, MMAMBUGUA_WHATSAPP_SENDER } from "../src/lib/whatsapp-sender-policy";
import { storeWhatsAppConnection, verifyWhatsAppConnection } from "../src/lib/whatsapp-cloud";

const message=(body:string,other:unknown[]=[] )=>({data:[{name:"hostel_utility",language:"en",status:"APPROVED",components:[{type:"BODY",text:body},...other]}]});
const input={
 phoneNumberId:"101010101010",businessAccountId:"202020202020",
 accessToken:"test-connection-token-is-not-real",templateName:"hostel_utility",templateLanguage:"en",apiVersion:"v26.0"
};
test("Meta verified number cannot silently change MMAMBUGUA's nominated central sender",()=>{
 assert.equal(MMAMBUGUA_WHATSAPP_SENDER,"254726717120");
 assert.equal(verifiedHostelSender("mama-mbugua-hostel","+254 726 717 120"),true);
 assert.equal(verifiedHostelSender("mama-mbugua-hostel","0726717120"),true);
 for(const value of ["+254714464701","+254722634013","",12345678,"not verified"]){
  assert.equal(verifiedHostelSender("mama-mbugua-hostel",value),false);
 }
 assert.equal(verifiedHostelSender("another-hostel","+254712345678"),true);
});
test("approved template matches exactly one body variable, rejecting unsupported extra or repeated placeholders",()=>{
 assert.equal(approvedSingleBodyTemplate(message("Hostel update: {{1}}"),"hostel_utility","en"),true);
 assert.equal(approvedSingleBodyTemplate(message("Hostel update: {{1}}",[{type:"FOOTER",text:"Contact hostel"}]),"hostel_utility","en"),true);
 for(const template of [
  message("Hostel update without any variables"),
  message("{{1}} {{1}}"),
  message("{{1}} {{2}}"),
  message("{{2}}"),
  message("{{1}}",[{type:"BUTTONS",buttons:[]}]),
  message("{{1}}",[{type:"BODY",text:"{{1}}"}]),
  {data:[{...message("{{1}}").data[0],status:"PENDING"}]},
  {data:[{...message("{{1}}").data[0],language:"sw"}]},
  {data:[]},
  {}
 ])assert.equal(approvedSingleBodyTemplate(template,"hostel_utility","en"),false,JSON.stringify(template));
});
test("a different Meta sender is rejected before any database write or token encryption",async()=>{
 const original=globalThis.fetch;
 let attempts=0, databaseWrites=0;
 globalThis.fetch=async(request:RequestInfo|URL)=>{
  attempts++;
  const url=String(request);
  return Response.json(url.includes("/message_templates")?message("Hostel update: {{1}}"):{display_phone_number:"+254714464701",verified_name:"Other business"});
 };
 const database={whatsAppConnection:{upsert:async()=>{databaseWrites++;}}} as unknown as PrismaClient;
 try{
  await assert.rejects(()=>storeWhatsAppConnection(database,"mama-mbugua-hostel",input,false),/HOSTEL_WHATSAPP_SENDER_MISMATCH/);
  assert.equal(attempts,2);
  assert.equal(databaseWrites,0);
 }finally{globalThis.fetch=original;}
});
test("an authentic Meta phone and one approved template can pass read-only provider verification",async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(request:RequestInfo|URL)=>{
  const url=String(request);
  return Response.json(url.includes("/message_templates")?message("Hostel update: {{1}}"):{display_phone_number:"+254 726 717 120",verified_name:"Approved Business"});
 };
 try{assert.equal(await verifyWhatsAppConnection(input),"+254 726 717 120");}
 finally{globalThis.fetch=original;}
});
test("owner setup remains explicit; Meta cloud actions cannot auto-activate based on a test token",()=>{
 const action=readFileSync("src/app/(app)/communications/whatsapp/connection-actions.ts","utf8");
 const cloud=readFileSync("src/lib/whatsapp-cloud.ts","utf8");
 const guide=readFileSync("src/components/whatsapp-connection-form.tsx","utf8");
 assert.match(cloud,/verifiedHostelSender\(organizationId,displayPhone\)/);
 assert.match(cloud,/approvedSingleBodyTemplate\(items,input.templateName,input.templateLanguage\)/);
 assert.match(action,/HOSTEL_WHATSAPP_SENDER_MISMATCH/);
 assert.match(action,/WHATSAPP_APP_SECRET&&process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN/);
 assert.match(guide,/Messaging Account ID/);
 assert.match(guide,/WAAC/);
 assert.match(guide,/PMA/);
 assert.match(guide,/without recipient permissions|recipient permissions/);
 assert.doesNotMatch(guide,/sendWhatsAppTemplate\(/);
});
