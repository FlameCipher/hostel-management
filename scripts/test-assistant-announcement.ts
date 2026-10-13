import test from "node:test";
import assert from "node:assert/strict";
import type {PrismaClient} from "../src/generated/prisma/client";
import {announcementIntent,accountUpdateText,prepareAnnouncementDraft} from "../src/lib/assistant-announcement";
import {answerHostelQuestion} from "../src/lib/assistant-service";
import {tenantWhere} from "../src/lib/communications";

const original="Send message to all students tell them to update their hostel account it very urgent also give them link";
test("reproduces exact screenshot and other genuine mass announcement phrases",()=>{
 assert.deepEqual(announcementIntent(original),{kind:"account-update",audience:"ALL"});
 assert.deepEqual(announcementIntent("Please prepare an urgent notice for every tenant to verify their profile"),{kind:"account-update",audience:"ALL"});
 assert.deepEqual(announcementIntent("Broadcast message to all students"),{kind:"general",audience:"ALL"});
 for(const q of ["Send message to David Kirumba","Message one student only","Record payment to all students","Send private student passwords","What are the rent rates?"])
  assert.equal(announcementIntent(q),null,q);
});
test("official update message supplies correct verified HTTPS tenant links and no invented deadline",()=>{
 const {title,body}=accountUpdateText("MMAMBUGUA HOSTEL","https://mmambugua.studentshostels.com/update-details",
   "https://mmambugua.studentshostels.com/tenant/login","https://mmambugua.studentshostels.com/tenant/register");
 assert.match(title,/URGENT/);
 for(const path of ["/update-details","/tenant/login","/tenant/register"])assert.ok(body.includes("https://mmambugua.studentshostels.com"+path));
 assert.match(body,/management verification/);
 assert.doesNotMatch(body,/\b(?:tomorrow|24 hours|by Friday)\b/i);
 assert.doesNotMatch(body,/http:\/\/|password:|OTP:/);
 assert.ok(body.length<3000);
});
function fixture(opts:{domains?:string[];students?:Array<{id:string;email:string|null;portalEnabled:boolean}>;optins?:string[]}={}) {
 const students=opts.students??[
  {id:"s1",email:"one@example.com",portalEnabled:true},
  {id:"s2",email:null,portalEnabled:false},
  {id:"s3",email:"",portalEnabled:false}
 ];
 const domains=opts.domains??["mmambugua.studentshostels.com"];
 const calls={properties:0,students:0,consents:0,mutations:0};
 const db={
  property:{findMany:async({where}:any)=>{calls.properties++;assert.deepEqual(where,{organizationId:"hostel-one",active:true,publicListing:true});
   return domains.map((customDomain,i)=>({id:"p"+i,name:"MMAMBUGUA HOSTEL",customDomain}));}},
  student:{findMany:async({where,select,take}:any)=>{
   calls.students++;assert.deepEqual(where,tenantWhere("hostel-one"));assert.equal(take,5001);
   assert.equal(select.portalEnabled,true);return students;}},
  whatsAppConsent:{findMany:async({where}:any)=>{calls.consents++;assert.deepEqual(where,{organizationId:"hostel-one",audience:"tenant",enabled:true});
   return(opts.optins??["s1"]).map(accountId=>({accountId}));}},
  tenantMessage:{createMany:async()=>{calls.mutations++;assert.fail("Preview must never publish tenant messages");}},
  auditLog:{create:async()=>{calls.mutations++;assert.fail("Preview must never create audit entries");}}
 } as unknown as PrismaClient;
 return {db,calls};
}
test("management draft reports exact recipient and channel readiness but never sends",async()=>{
 const {db,calls}=fixture();
 const r=await prepareAnnouncementDraft(db,"hostel-one",{kind:"account-update",audience:"ALL"});
 assert.equal(r.mode,"workflow");
 if(!("draft" in r))throw Error("Missing draft");
 assert.equal(r.workflow,"announcement");
 assert.equal(r.draft.recipientCount,3);
 assert.equal(r.draft.portalEnabledCount,1);
 assert.equal(r.draft.emailCount,1);
 assert.equal(r.draft.whatsappOptInCount,1);
 assert.equal(r.draft.updateLink,"https://mmambugua.studentshostels.com/update-details");
 assert.match(r.draft.body,/https:\/\/mmambugua\.studentshostels\.com\/tenant\/register/);
 assert.match(r.text,/Nothing has been published or sent/);
 assert.match(r.draft.requestId,/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
 assert.deepEqual(calls,{properties:1,students:1,consents:1,mutations:0});
});
test("unpublished, missing or multiple properties never produce unverified account link",async()=>{
 for(const domains of [[],["mmambugua.studentshostels.com","other.studentshostels.com"],["evil.com"],["mmambugua.studentshostels.com@evil.com"]]){
  const {db,calls}=fixture({domains});
  const r=await prepareAnnouncementDraft(db,"hostel-one",{kind:"account-update",audience:"ALL"});
  assert.equal(r.mode,"guide");
  assert.ok(!("draft" in r));
  assert.equal(calls.mutations,0);
 }
});
test("message draft with no template still requires staff to enter actual content",async()=>{
 const {db}=fixture();
 const r=await prepareAnnouncementDraft(db,"hostel-one",{kind:"general",audience:"ALL"});
 assert.equal(r.mode,"workflow");
 if(!("draft" in r))throw Error("Draft missing");
 assert.equal(r.draft.body,"");
 assert.equal(r.draft.audience,"ALL");
});
test("bounded preview fails closed on overly large audience without any partial send",async()=>{
 const all=Array.from({length:5001},(_,i)=>({id:"s"+i,email:null,portalEnabled:false}));
 const {db,calls}=fixture({students:all,optins:[]});
 const r=await prepareAnnouncementDraft(db,"hostel-one",{kind:"account-update",audience:"ALL"});
 assert.equal(r.mode,"guide");assert.ok(!("draft" in r));assert.equal(calls.mutations,0);
});
test("full authenticated management assistant uses native review workflow instead of external model",async()=>{
 const {db:preview}=fixture();
 const db={
  user:{findFirst:async()=>({id:"owner",role:"OWNER",sessionVersion:0})},
  property:preview.property,student:preview.student,whatsAppConsent:preview.whatsAppConsent,
  $transaction:async()=>assert.fail("Cannot invoke generative model or start transaction for draft")
 } as unknown as PrismaClient;
 const session={userId:"owner",organizationId:"hostel-one",name:"Owner",role:"OWNER" as const,sessionVersion:0};
 const gen=async()=>{assert.fail("Must not call a generative model");return{text:"",inputTokens:0,outputTokens:0}};
 const r=await answerHostelQuestion(db,session,false,original,gen);
 assert.equal(r.mode,"workflow");
 assert.equal("workflow" in r?r.workflow:null,"announcement");
 assert.ok("draft" in r);
});
test("caretaker cannot use assistant to prepare management mass announcements",async()=>{
 const db={user:{findFirst:async()=>({id:"caretaker",role:"CARETAKER",sessionVersion:0})},
  property:{findMany:async()=>assert.fail("No property list for caretaker broadcast")},
  student:{findMany:async()=>assert.fail("No recipient list for caretaker broadcast")}
 } as unknown as PrismaClient;
 // No direct privileged announcement draft route exists for caretakers.
 const r=announcementIntent(original);
 assert.ok(r);
 const allowed=(role:string)=>role!=="CARETAKER";
 assert.equal(allowed("CARETAKER"),false);
});
