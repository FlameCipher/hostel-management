import test from "node:test";
import { TERMS_VERSION } from "../src/lib/hostel-terms/policy";
import assert from "node:assert/strict";
import type {PrismaClient} from "../src/generated/prisma/client";
import {answerHostelKnowledge} from "../src/lib/assistant-knowledge-reader";

function dbFixture(options:{published?:boolean;multiple?:boolean;roomActive?:boolean}={}) {
 const property={id:"property-a",name:"MMAMBUGUA HOSTEL",city:"Juja",physicalAddress:"Highpoint Road",phone:"0714 464 701",email:null,
  customDomain:"mmambugua.studentshostels.com",publicDescription:"Hostel near JKUAT",timeZone:"Africa/Nairobi",rentPaymentMethods:["MPESA"],publicListing:true};
 const org={id:"mama-mbugua-hostel",status:"ACTIVE",name:"MMAMBUGUA HOSTEL",ownerName:"Approved owner",phone:"0714 464 701",email:null,currency:"KES"};
 const calls:{room:number;properties:number;semesters:number}={room:0,properties:0,semesters:0};
 const db={
  organization:{findUnique:async ({where}:any)=>{assert.equal(where.id,org.id);return org;}},
  property:{findMany:async ({where}:any)=>{calls.properties++;assert.equal(where.organizationId,org.id);assert.equal(where.active,true);if(options.published)assert.equal(where.publicListing,true);return options.multiple?[property,{...property,id:"other",name:"Another property"}]:[property];}},
  room:{findMany:async ({where}:any)=>{calls.room++;assert.equal(where.organizationId,org.id);assert.equal(where.roomType.active,true);
   return [{propertyId:"property-a",status:"VACANT",capacityOverride:null,roomType:{id:"private-single",name:"Single",monthlyRate:4500,semesterRate:18000,currency:"KES",sharingMode:"PRIVATE",defaultCapacity:1},occupancies:[]},
   {propertyId:"property-a",status:"FULL",capacityOverride:null,roomType:{id:"private-single",name:"Single",monthlyRate:4500,semesterRate:18000,currency:"KES",sharingMode:"PRIVATE",defaultCapacity:1},occupancies:[{id:"active"}]}];}},
  semester:{findMany:async ({where}:any)=>{calls.semesters++;assert.equal(where.organizationId,org.id);return [{name:"Semester 2026",startDate:new Date("2026-09-01"),endDate:new Date("2026-12-31"),status:"ACTIVE"}];}}
 };
 return {db:db as unknown as PrismaClient,calls};
}
test("official visitor policy is sourced from the versioned hostel terms and no provider guess",async()=>{
 const {db,calls}=dbFixture();
 const answer=await answerHostelKnowledge(db,"mama-mbugua-hostel","TENANT","Can visitors stay in a student's room?");
 assert.equal(answer?.mode,"records");
 assert.ok(answer?.text.includes(TERMS_VERSION));
 assert.match(answer?.text??"",/Visitors are not permitted inside students' rooms/);
 assert.equal(calls.room,0);
});
test("published tenant queries never return private unpublished properties",async()=>{
 const {db}=dbFixture({published:true});
 const answer=await answerHostelKnowledge(db,"mama-mbugua-hostel","TENANT","Where is the hostel?");
 assert.match(answer?.text??"",/Juja/);
});
test("active configured room rates and recorded vacancies remain explicit estimates",async()=>{
 const {db,calls}=dbFixture();
 const a=await answerHostelKnowledge(db,"mama-mbugua-hostel","MANAGEMENT","How much is a single room per semester?");
 assert.match(a?.text??"",/KES 18,000.00/);
 assert.match(a?.text??"",/KES 4,500.00/);
 const b=await answerHostelKnowledge(db,"mama-mbugua-hostel","MANAGEMENT","Are rooms vacant?");
 assert.match(b?.text??"",/1 nominal free bed spaces/);
 assert.match(b?.text??"",/estimate/);
 assert.equal(calls.room,2);
});
test("unverified power supply and founding dates are not invented",async()=>{
 const {db}=dbFixture();
 const power=await answerHostelKnowledge(db,"mama-mbugua-hostel","MANAGEMENT","Is the electricity working?");
 assert.match(power?.text??"",/not recorded in the verified hostel information/);
 const history=await answerHostelKnowledge(db,"mama-mbugua-hostel","MANAGEMENT","When was this hostel founded?");
 assert.match(history?.text??"",/not recorded/);
});
test("ownership is not shown to a signed-in caretaker or tenant from private organization fields",async()=>{
 const {db}=dbFixture();
 const management=await answerHostelKnowledge(db,"mama-mbugua-hostel","MANAGEMENT","Who owns the hostel?");
 assert.match(management?.text??"",/Recorded organization owner/);
 const tenant=await answerHostelKnowledge(db,"mama-mbugua-hostel","TENANT","Who owns the hostel?");
 assert.doesNotMatch(tenant?.text??"",/Recorded organization owner/);
});
