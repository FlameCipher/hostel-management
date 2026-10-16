import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import { communicationManager, publishCommunication, scheduledDate, outstanding, nairobiDay, tenantWhere } from "../src/lib/communications";
const session={userId:"owner",organizationId:"hostel",name:"Owner",role:"OWNER" as const};
const input={title:"Exam wishes",body:"We wish you success in your exams.",audience:"SELECTED",studentIds:["one"],category:"EXAM",publishAt:new Date("2026-10-10T05:00:00Z"),whatsapp:false,requestId:"b6dba362-fb3a-465a-8f65-226827a1d511"};
function fixture(eligible=["one"],authorized=true,portalReadyIds:string[]=[]){
 const messages=new Map(),audits:unknown[]=[];let queries=0;
 const tx={organization:{findUnique:async()=>({whatsappEnabled:true})},student:{findMany:async()=>{queries++;return eligible.map(id=>({id,portalEnabled:portalReadyIds.includes(id),portalPasswordHash:portalReadyIds.includes(id)?"opaque-existing-hash":null}))}},tenantMessage:{createMany:async({data}:{data:{studentId:string;dedupKey:string}})=>{const key=data.studentId+data.dedupKey;if(messages.has(key))return{count:0};messages.set(key,data);return{count:1}}},auditLog:{create:async(v:unknown)=>{audits.push(v)}}};
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

test("notice composer offers all or selected tenants, search and review confirmation", async()=>{
 const { readFileSync } = await import("node:fs");
 const source=readFileSync(new URL("../src/components/communication-form.tsx",import.meta.url),"utf8");
 assert.match(source,/name="audience" value="ALL"/);
 assert.match(source,/name="audience" value="SELECTED"/);
 assert.match(source,/name="studentIds" type="checkbox"/);
 assert.match(source,/Select all shown/);
 assert.match(source,/Clear selection/);
 assert.match(source,/recipientCount === 0 \|\| !confirmed/);
 assert.match(source,/private inbox record/);
 assert.match(source,/pendingPortalAccess/);
 assert.match(source,/not proof of delivery or reading/);
 assert.match(source,/Save notices for/);
 assert.match(source,/WhatsApp copies are queued as drafts/);
});
test("WhatsApp composer has all or selected recipients with explicit approval",async()=>{
 const { readFileSync } = await import("node:fs");
 const source=readFileSync(new URL("../src/components/whatsapp-draft-form.tsx",import.meta.url),"utf8");
 assert.match(source,/name="selection" value="ALL"/);
 assert.match(source,/name="selection" value="SELECTED"/);
 assert.match(source,/Select all shown/);
 assert.match(source,/Clear selection/);
 assert.match(source,/!reviewed/);
 assert.match(source,/Each message stays private/);
});

test("published notices distinguish portal access from unread inbox records and external delivery",async()=>{
 const f=fixture(["one","two"],true,["one"]);
 const response=await publishCommunication(f.db,session,{...input,audience:"ALL",studentIds:[],email:false,whatsapp:false});
 assert.match(response.success??"",/Saved 2 private tenant notices/);
 assert.match(response.success??"",/1 recipient currently have portal access, and 1 cannot read/);
 assert.match(response.success??"",/No email copies requested/);
 assert.match(response.success??"",/No WhatsApp copies requested/);
 assert.match(response.success??"",/actual delivery and read statuses/);
 assert.equal(f.messages.size,2);
 assert.equal(f.audits.length,1);
 const audit=f.audits[0] as {data:{metadata:Record<string,unknown>}};
 assert.equal(audit.data.metadata.activePortals,1);
 assert.equal(audit.data.metadata.withoutActivePortal,1);
});

test("requested email and WhatsApp remain explicitly queued or draft, not delivered",async()=>{
 const f=fixture(["one"],true,[]);
 const response=await publishCommunication(f.db,session,{...input,email:true,whatsapp:true});
 assert.match(response.success??"",/Email copies requested for queue processing, not confirmed delivered/);
 assert.match(response.success??"",/WhatsApp copies requested as drafts, not sent/);
 assert.equal(f.messages.size,1);
});

test("only portal access flags are passed to the client, never password hashes",async()=>{
 const {readFileSync}=await import("node:fs");
 const page=readFileSync(new URL("../src/app/(app)/communications/page.tsx",import.meta.url),"utf8");
 assert.match(page,/portalReady:student.portalEnabled && student.portalPasswordHash!==null/);
 assert.match(page,/<CommunicationForm students=\{students.map\(student=>\(\{/);
 const form=readFileSync(new URL("../src/components/communication-form.tsx",import.meta.url),"utf8");
 assert.match(form,/portalReady: boolean/);
 assert.doesNotMatch(form,/portalPasswordHash/);
});
