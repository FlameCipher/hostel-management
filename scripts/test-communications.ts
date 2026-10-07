import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import { communicationManager, publishCommunication, scheduledDate, outstanding, nairobiDay, tenantWhere } from "../src/lib/communications";
const session={userId:"owner",organizationId:"hostel",name:"Owner",role:"OWNER" as const};
const input={title:"Exam wishes",body:"We wish you success in your exams.",audience:"SELECTED",studentIds:["one"],category:"EXAM",publishAt:new Date("2026-10-10T05:00:00Z"),whatsapp:false,requestId:"b6dba362-fb3a-465a-8f65-226827a1d511"};
function fixture(eligible=["one"],authorized=true){
 const messages=new Map(),audits:unknown[]=[];let queries=0;
 const tx={organization:{findUnique:async()=>({whatsappEnabled:true})},student:{findMany:async()=>{queries++;return eligible.map(id=>({id}))}},tenantMessage:{createMany:async({data}:{data:{studentId:string;dedupKey:string}})=>{const key=data.studentId+data.dedupKey;if(messages.has(key))return{count:0};messages.set(key,data);return{count:1}}},auditLog:{create:async(v:unknown)=>{audits.push(v)}}};
 const db={user:{findFirst:async()=>authorized?{id:"owner"}:null},$transaction:async(fn:(v:unknown)=>unknown)=>fn(tx)} as unknown as PrismaClient;
 return {db,messages,audits,get queries(){return queries}};
}
test("unauthenticated publishing never queries recipients",async()=>{const f=fixture();assert.match((await publishCommunication(f.db,null,input)).error!,/management/);assert.equal(f.queries,0)});
test("revoked management cannot publish",async()=>{const f=fixture(["one"],false);assert.ok((await publishCommunication(f.db,session,input)).error);assert.equal(f.messages.size,0)});
test("selected foreign or former tenant rejects entire audience",async()=>{const f=fixture([]);assert.ok((await publishCommunication(f.db,session,input)).error);assert.equal(f.messages.size,0);assert.equal(f.audits.length,0)});
test("selected recipients cannot be empty",async()=>{const f=fixture();assert.ok((await publishCommunication(f.db,session,{...input,studentIds:[]})).error);assert.equal(f.queries,0)});
test("duplicate request writes one message and one audit",async()=>{const f=fixture();assert.ok("success" in (await publishCommunication(f.db,session,input)));assert.ok("success" in (await publishCommunication(f.db,session,input)));assert.equal(f.messages.size,1);assert.equal(f.audits.length,1)});
test("all audience writes distinct private recipient rows",async()=>{const f=fixture(["one","two"]);await publishCommunication(f.db,session,{...input,audience:"ALL",studentIds:[]});assert.equal(f.messages.size,2)});
test("manager guard checks database active role and scope",async()=>{let where:unknown;const db={user:{findFirst:async(args:{where:unknown})=>{where=args.where;return null}}} as unknown as PrismaClient;await communicationManager(db,session);assert.deepEqual(where,{id:"owner",organizationId:"hostel",active:true,role:{in:["OWNER","ADMIN","MANAGER"]}})});
test("tenant audience requires a current allocation in the same hostel",()=>{const where=tenantWhere("hostel");assert.equal(where.organizationId,"hostel");assert.equal(where.status,"ACTIVE");assert.deepEqual(where.occupancies,{some:{organizationId:"hostel",status:{in:["ACTIVE","RESERVED"]},room:{organizationId:"hostel"},semester:{organizationId:"hostel"}}})});
test("Nairobi schedule converts to UTC and rejects past or malformed date",()=>{const now=new Date("2026-10-08T00:00:00Z");assert.equal(scheduledDate("2026-10-10T08:00",now)?.toISOString(),"2026-10-10T05:00:00.000Z");assert.equal(scheduledDate("2026-10-01T08:00",now),null);assert.equal(scheduledDate("invalid",now),null)});
test("Nairobi day uses local midnight",()=>{assert.equal(nairobiDay(new Date("2026-10-09T21:01:00Z")),"2026-10-10")});
test("balance subtracts provided unreversed payments and never negative",()=>{assert.equal(outstanding("18000.10",[{amount:"5000.05"}]),13000.05);assert.equal(outstanding("100",[{amount:"101"}]),0)});
