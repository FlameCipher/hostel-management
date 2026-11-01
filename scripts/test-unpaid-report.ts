import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import { readUnpaidReport, prepareStaffReport } from "../src/lib/unpaid-report";
import { unpaidReportPdf } from "../src/lib/unpaid-report-pdf";
import { PDFDocument } from "pdf-lib";
const now=new Date("2026-11-01T05:00:00Z"), session={userId:"owner",organizationId:"hostel",role:"OWNER" as const,name:"Owner",sessionVersion:0};
function fixture(){
 const charge=(id:string,amount=100,paid=0,due="2026-10-01")=>({id,organizationId:"hostel",studentId:id,currency:"KES",amount,dueDate:new Date(due),status:"UNPAID",payments:paid?[{amount:paid,organizationId:"hostel",studentId:id,currency:"KES",reversedAt:null}]:[]});
 const student=(id:string,c=charge(id),date:Date|null=null)=>({id,fullName:"Student "+id,gender:null,paymentAgreedDate:date,occupancies:[{room:{number:"1"}}],charges:[c]});
 const students=[student("overdue"),student("future",charge("future",100,0,"2026-12-01")),student("agreed",charge("agreed"),new Date("2026-11-03")),student("paid",charge("paid",100,100)),student("bad",charge("bad",100,120))];
 let active=true,recipient=true;const audits:unknown[]=[];
 const db={user:{findFirst:async({where}:{where:{id:string;organizationId:string}})=>{assert.equal(where.organizationId,"hostel");return where.id==="owner"?(active?{id:"owner",role:"OWNER",sessionVersion:0}:null):recipient&&where.id==="staff"?{id:"staff",name:"Caretaker",role:"CARETAKER",phone:"0712345678"}:null;}},organization:{findFirst:async()=>({name:"Example Hostel",currency:"KES"})},student:{findMany:async({where}:{where:{organizationId:string}})=>{assert.equal(where.organizationId,"hostel");return students;}},auditLog:{create:async(input:unknown)=>{audits.push(input);}},$transaction:async(fn:(tx:unknown)=>unknown)=>fn(db)} as unknown as PrismaClient;
 return{db,students,audits,revoke:()=>{active=false;},removeRecipient:()=>{recipient=false;}};
}
test("report separates unpaid, overdue, agreements, cleared and invalid ledgers",async()=>{
 const f=fixture(),r=await readUnpaidReport(f.db,"hostel",now);
 assert.equal(r.rows.length,3);assert.equal(r.reviewCount,1);
 assert.equal(r.rows.find(r=>r.studentId==="future")?.status,"Not overdue");
 assert.equal(r.rows.find(r=>r.studentId==="agreed")?.demandEligible,false);
 assert.equal(r.rows.find(r=>r.studentId==="overdue")?.demandEligible,true);
 assert.ok(!JSON.stringify(r).includes("0712345678"));
});
test("staff export requires live authority, same-hostel recipient, exact preview and approval",async()=>{
 const f=fixture(),r=await readUnpaidReport(f.db,"hostel",now),input={recipientId:"staff",recipientPhone:"254712345678",fingerprint:r.fingerprint,confirmed:true};
 assert.ok("error" in await prepareStaffReport(f.db,null,input,now));
 assert.ok("error" in await prepareStaffReport(f.db,session,{...input,confirmed:false},now));
 assert.ok("error" in await prepareStaffReport(f.db,session,{...input,recipientId:"foreign"},now));
 assert.ok("error" in await prepareStaffReport(f.db,session,{...input,recipientPhone:"254700000000"},now));
 assert.ok("error" in await prepareStaffReport(f.db,session,{...input,fingerprint:"0".repeat(64)},now));
 assert.equal(f.audits.length,0);
 assert.ok("report" in await prepareStaffReport(f.db,session,input,now));assert.equal(f.audits.length,1);
 f.revoke();assert.ok("error" in await prepareStaffReport(f.db,session,input,now));
});
test("changed payment or agreement makes a PDF preview stale",async()=>{
 const f=fixture(),r=await readUnpaidReport(f.db,"hostel",now);
 f.students[0].paymentAgreedDate=new Date("2026-11-04");
 const result=await prepareStaffReport(f.db,session,{recipientId:"staff",recipientPhone:"254712345678",fingerprint:r.fingerprint,confirmed:true},now);
 assert.ok("error" in result);assert.equal(f.audits.length,0);
});
test("PDF renders long names across pages and contains no student contact fields",async()=>{
 const f=fixture(),r=await readUnpaidReport(f.db,"hostel",now);
 const rows=Array.from({length:90},(_,i)=>({...r.rows[0],name:"Example student "+i+" very long name with accents é and international 字",studentId:String(i)}));
 const bytes=await unpaidReportPdf({...r,rows},{name:"Example caretaker",role:"CARETAKER"});
 const parsed=await PDFDocument.load(bytes);assert.ok(parsed.getPageCount()>=3);assert.match(parsed.getTitle()!,/confidential staff/);
});
