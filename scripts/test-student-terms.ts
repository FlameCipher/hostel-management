import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import type { PrismaClient } from "../src/generated/prisma/client";
import { currentTermsContext, signStudentTerms, tenantTermsRecord, managerTermsRecord } from "../src/lib/hostel-terms/service";
import { TERMS_VERSION, TERMS_ORGANIZATION_ID, termsHash } from "../src/lib/hostel-terms/policy";
import { generateTermsPdf, termsPdfResponse } from "../src/lib/hostel-terms/pdf";
const session = { studentId: "student-one", organizationId: TERMS_ORGANIZATION_ID, name: "Student One" };
function harness(options: { disabled?: boolean; noOccupancy?: boolean; duplicate?: boolean; auditFails?: boolean; dbFails?: boolean; manager?: boolean } = {}) {
  const calls: { method: string; args?: unknown }[] = [];
  const student = { id:session.studentId, fullName:"Student One", admissionNumber:"TEST-001", university:"Test University" };
  const occupancy = { id:"allocation-one", room:{number:"A1"}, semester:{name:"Semester One", startDate:new Date("2026-09-01"), endDate:new Date("2026-12-31")}, charges:[{amount:{toFixed:()=>"18000.00"}, dueDate:new Date("2026-10-10")}] };
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => { calls.push({method:"lock",args:{sql:strings.join("?"),values}}); return [{id:session.studentId}]; },
    student: {findFirst:async (args:unknown) => {calls.push({method:"student",args});return options.disabled?null:student;}},
    occupancy: {findFirst:async (args:unknown) => {calls.push({method:"occupancy",args});return options.noOccupancy?null:occupancy;}},
    user: {findFirst:async(args:unknown)=>{calls.push({method:"manager",args});return options.manager?{id:"manager"}:null;}},
    studentTermsAcceptance: {findFirst:async(args:unknown)=>{calls.push({method:"record",args});return options.duplicate?{id:"existing"}:null;},create:async(args:{data:unknown})=>{calls.push({method:"create",args});return {id:"saved",...args.data as object};}},
    auditLog: {create:async(args:unknown)=>{calls.push({method:"audit",args});if(options.auditFails)throw Error("audit failed");}},
  };
  const db = {...tx, $transaction:async (fn:(arg:typeof tx)=>unknown)=>{if(options.dbFails)throw Error("db unavailable");return fn(tx)}} as unknown as PrismaClient;
  return { db, calls };
}
async function input(h:ReturnType<typeof harness>) {const c=await currentTermsContext(h.db,session);assert.ok(c?.snapshot);return {version:TERMS_VERSION,occupancyId:"allocation-one",signatureName:"Student One",agree:"yes",documentHash:termsHash(c.snapshot,"",new Date(0),"preview")};}
for (const s of [null,{...session,organizationId:"other-hostel"}]) test("unauthorized signing makes no database calls "+JSON.stringify(s),async()=>{const h=harness();assert.ok((await signStudentTerms(h.db,s,{})).error);assert.equal(h.calls.length,0)});
for(const change of [{agree:"no"},{signatureName:"Other Student"},{version:"old-version"},{occupancyId:"foreign-allocation"},{documentHash:"0".repeat(64)},{signatureName:"Student\nOne"}])test("reject invalid signature or stale context "+JSON.stringify(change),async()=>{const h=harness();assert.ok((await signStudentTerms(h.db,session,{...await input(h),...change})).error);assert.equal(h.calls.some(c=>c.method==="create"),false)});
test("disabled student cannot sign",async()=>{const h=harness({disabled:true});const good=await input(harness());assert.ok((await signStudentTerms(h.db,session,good)).error);assert.equal(h.calls.some(c=>c.method==="create"),false)});
test("missing allocation cannot sign",async()=>{const h=harness({noOccupancy:true});assert.ok((await signStudentTerms(h.db,session,await input(harness()))).error)});
test("signing locks student and allocation then records snapshot and audit atomically",async()=>{const h=harness();const good=await input(h);h.calls.length=0;assert.deepEqual(await signStudentTerms(h.db,session,good),{id:"saved"});assert.deepEqual(h.calls.slice(0,2).map(c=>c.method),["lock","lock"]);const saved=h.calls.find(c=>c.method==="create")!.args as {data:{snapshot:unknown;organizationId:string;studentId:string;signatureName:string;acceptedAt:Date;reference:string;integrityHash:string}};assert.equal(saved.data.organizationId,session.organizationId);assert.equal(saved.data.studentId,session.studentId);assert.ok(saved.data.reference.startsWith("MMH-TERMS-"));assert.equal(h.calls.at(-1)?.method,"audit")});
test("duplicate submission returns original record without changing signature or audit",async()=>{const h=harness({duplicate:true});assert.deepEqual(await signStudentTerms(h.db,session,await input(h)),{id:"existing"});assert.equal(h.calls.some(c=>c.method==="create"||c.method==="audit"),false)});
test("audit failure propagates through transaction for rollback",async()=>{const h=harness({auditFails:true});await assert.rejects(signStudentTerms(h.db,session,await input(h)),/audit failed/)});
test("tenant download is scoped to own student and organization and rechecks portal",async()=>{const h=harness();await tenantTermsRecord(h.db,session,"record");const q=h.calls.find(c=>c.method==="record")!.args as {where:{studentId:string;organizationId:string}};assert.equal(q.where.studentId,session.studentId);assert.equal(q.where.organizationId,session.organizationId)});
test("disabled portal cannot read signed copies",async()=>{const h=harness({disabled:true});assert.equal(await tenantTermsRecord(h.db,session,"record"),null);assert.equal(h.calls.some(c=>c.method==="record"),false)});
test("foreign hostel cannot read tenant copies",async()=>{const h=harness();assert.equal(await tenantTermsRecord(h.db,{...session,organizationId:"foreign"},"record"),null);assert.equal(h.calls.length,0)});
const admin={userId:"manager",organizationId:session.organizationId,name:"Manager",role:"OWNER" as const};
test("inactive or unauthorized manager cannot read copies",async()=>{const h=harness();assert.equal(await managerTermsRecord(h.db,admin,"record"),null);assert.equal(h.calls.some(c=>c.method==="record"),false)});
test("manager download rechecks database role and scopes organization",async()=>{const h=harness({manager:true});await managerTermsRecord(h.db,admin,"record");const auth=h.calls.find(c=>c.method==="manager")!.args as {where:{active:boolean;role:{in:string[]}}};assert.equal(auth.where.active,true);assert.deepEqual(auth.where.role.in,["OWNER","ADMIN","MANAGER"]);const q=h.calls.find(c=>c.method==="record")!.args as {where:{organizationId:string}};assert.equal(q.where.organizationId,session.organizationId)});
async function record(){const c=await currentTermsContext(harness().db,session);assert.ok(c?.snapshot);const acceptedAt=new Date("2026-10-07T21:30:00Z"),signatureName="Student One",reference="MMH-TERMS-EXAMPLE";return {version:TERMS_VERSION,snapshot:c.snapshot,acceptedAt,signatureName,reference,integrityHash:termsHash(c.snapshot,signatureName,acceptedAt,reference)};}
test("stored JSON key reordering does not break snapshot integrity",async()=>{const r=await record();const reordered=Object.fromEntries(Object.entries(r.snapshot).reverse());assert.equal(termsHash(reordered as typeof r.snapshot,r.signatureName,r.acceptedAt,r.reference),r.integrityHash)});
test("signed PDF has multiple complete pages and private attachment headers",async()=>{const r=await record();const pdf=await generateTermsPdf(r);const loaded=await PDFDocument.load(pdf);assert.ok(loaded.getPageCount()>=2);assert.match(loaded.getTitle()!,/EXAMPLE/);const response=await termsPdfResponse(r);assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"private, no-store");assert.match(response.headers.get("content-disposition")!,/^attachment;/)});
for(const key of ["signatureName","reference","integrityHash"] as const)test("tampered "+key+" rejects PDF",async()=>{const r=await record();await assert.rejects(generateTermsPdf({...r,[key]:"tampered"}),/INTEGRITY/);assert.equal((await termsPdfResponse({...r,[key]:"tampered"})).status,503)});
test("missing unsigned copy cannot download",async()=>assert.equal((await termsPdfResponse(null)).status,404));
