import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import type {PrismaClient} from "../src/generated/prisma/client";
import {editStudentLesson,lessonOccurrences,dueLessonReminders} from "../src/lib/student-timetable";

const me={organizationId:"hostel-A",studentId:"student-A",name:"My Student",sessionVersion:3};
const initial={id:"L1",organizationId:"hostel-A",studentId:"student-A",propertyId:"property-A",title:"Mathematics",
 courseCode:"MAT 102",venue:"Hall A",dayOfWeek:1,startMinutes:540,endMinutes:600,
 timeZone:"Africa/Nairobi",remindBeforeMinutes:15,reminderEnabled:true,active:true};
const proposal={id:"L1",title:"Applied Mathematics",courseCode:"MAT 202",venue:"Hall B",dayOfWeek:1,
 startTime:"11:00",endTime:"12:00",remindBeforeMinutes:30,reminderEnabled:true};
function fixture(options:{blocked?:boolean;foreign?:boolean;ambiguous?:boolean;overlap?:boolean;duplicated?:boolean}={}){
 const lessons=[{...initial}];
 let updated=0,cancelled=0;
 const audits:any[]=[],pushFilters:any[]=[];
 const other={id:"L2",title:"Chemistry",dayOfWeek:1,startMinutes:660,endMinutes:720};
 const tx={
  $queryRaw:async()=>[],
  student:{findFirst:async({where}:any)=>{
    assert.equal(where.organizationId,"hostel-A");return options.blocked?null:{id:"student-A",portalSessionVersion:3};
  }},
  occupancy:{findMany:async({where}:any)=>{
    assert.equal(where.organizationId,"hostel-A");return options.ambiguous?[]:[{room:{propertyId:"property-A",property:{timeZone:"Africa/Nairobi",countryCode:"KE"}}}];
  }},
  studentLesson:{
   findFirst:async({where}:any)=>{
     assert.equal(where.organizationId,"hostel-A");
     assert.equal(where.studentId,"student-A");
     assert.equal(where.propertyId,"property-A");
     return options.foreign?null:lessons[0];
   },
   findMany:async({where}:any)=>{
    assert.equal(where.organizationId,"hostel-A");assert.equal(where.studentId,"student-A");
    assert.deepEqual(where.id,{not:"L1"});
    return options.overlap?[other]:options.duplicated?[{...other,title:proposal.title}]:[];
   },
   update:async({where,data}:any)=>{
    assert.equal(where.id,"L1");updated++;
    Object.assign(lessons[0],data);
    return lessons[0];
   }
  },
  pushDelivery:{updateMany:async({where,data}:any)=>{
   pushFilters.push(where);
   assert.equal(where.subjectId,"L1");
   assert.equal(where.kind,"CLASS_REMINDER");
   assert.deepEqual(where.status,{in:["QUEUED","FAILED"]});
   assert.deepEqual(where.subscription,{organizationId:"hostel-A",accountId:"student-A",audience:"tenant"});
   assert.equal(data.status,"CANCELLED");cancelled++;return{count:2};
  }},
  auditLog:{create:async({data}:any)=>{audits.push(data);return{};}}
 };
 const db={$transaction:async(fn:(db:typeof tx)=>unknown)=>fn(tx)} as unknown as PrismaClient;
 return {db,lessons,audits,pushFilters,get updated(){return updated},get cancelled(){return cancelled}};
}
test("student edits the same lesson in place and cancels scheduled stale reminders",async()=>{
 const f=fixture();
 const r=await editStudentLesson(f.db,me,proposal);
 assert.match(r.success??"",/Class updated/);
 assert.equal(f.updated,1);
 assert.equal(f.lessons.length,1);
 assert.equal(f.lessons[0].id,"L1");
 assert.equal(f.lessons[0].startMinutes,660);assert.equal(f.lessons[0].endMinutes,720);
 assert.equal(f.lessons[0].remindBeforeMinutes,30);
 assert.equal(f.lessons[0].venue,"Hall B");
 assert.equal(f.cancelled,1);
 assert.equal(f.audits[0].action,"STUDENT_LESSON_UPDATED");
 assert.equal(f.audits[0].organizationId,"hostel-A");
 assert.deepEqual(f.audits[0].metadata.fieldsChanged.sort(),["title","courseCode","venue","startMinutes","endMinutes","remindBeforeMinutes"].sort());
 assert.doesNotMatch(JSON.stringify(f.audits),/Applied Mathematics|Hall B|My Student/);
 const upcoming=lessonOccurrences(f.lessons,new Date("2026-10-19T07:00:00Z"),2);
 assert.equal(upcoming[0].startAt.toISOString(),"2026-10-19T08:00:00.000Z");
 assert.equal(dueLessonReminders(f.lessons,new Date("2026-10-19T07:31:00Z"))[0]?.kind,"PREP");
});
test("unauthorized, foreign class and no current room never update another student",async()=>{
 for(const item of [
  {session:null,options:{}},
  {session:me,options:{blocked:true}},
  {session:me,options:{foreign:true}},
  {session:me,options:{ambiguous:true}},
 ]){
  const f=fixture(item.options);
  const r=await editStudentLesson(f.db,item.session,proposal);
  assert.ok(r.error,JSON.stringify(item.options));
  assert.equal(f.updated,0);assert.equal(f.cancelled,0);assert.equal(f.audits.length,0);
 }
});
test("overlapping time and exact duplicate are blocked without mutation",async()=>{
 for(const opts of [{overlap:true},{duplicated:true}]){
  const f=fixture(opts);
  const r=await editStudentLesson(f.db,me,proposal);
  assert.ok(r.error);
  assert.equal(f.updated,0);assert.equal(f.cancelled,0);
 }
});
test("validation rejects invalid times, edits and timetable input before database access",async()=>{
 let transaction=0;
 const db={$transaction:async()=>{transaction++;throw Error("unexpected transaction")}} as unknown as PrismaClient;
 for(const data of [
  {...proposal,id:""},
  {...proposal,startTime:"12:01",endTime:"12:00"},
  {...proposal,startTime:"07:00",endTime:"19:00"},
  {...proposal,dayOfWeek:7},
  {...proposal,title:"x"},
  {...proposal,remindBeforeMinutes:23},
 ]){
  const r=await editStudentLesson(db,me,data);assert.ok(r.error);
 }
 assert.equal(transaction,0);
});
test("unchanged class remains untouched; no duplicate audit or push cancellation",async()=>{
 const f=fixture();
 const r=await editStudentLesson(f.db,me,{
  id:"L1",title:"Mathematics",courseCode:"MAT 102",venue:"Hall A",
  dayOfWeek:1,startTime:"09:00",endTime:"10:00",remindBeforeMinutes:15,reminderEnabled:true
 });
 assert.match(r.success??"",/already up to date/);
 assert.equal(f.updated,0);assert.equal(f.cancelled,0);assert.equal(f.audits.length,0);
});
test("live UI exposes full private edit form and authenticated action, not management timetable",()=>{
 const page=readFileSync("src/app/tenant/timetable/page.tsx","utf8");
 const components=readFileSync("src/components/student-timetable-forms.tsx","utf8");
 const actions=readFileSync("src/app/tenant/timetable/actions.ts","utf8");
 const service=readFileSync("src/lib/student-timetable.ts","utf8");
 assert.match(page,/TimetableEditForm lesson=\{item\}/);
 assert.match(components,/useActionState\(editLessonAction/);
 for(const field of ["title","courseCode","venue","dayOfWeek","startTime","endTime","remindBeforeMinutes","reminderEnabled"])
  assert.match(components,new RegExp('name="'+field+'"'));
 assert.match(components,/Save class changes/);
 assert.match(actions,/requireTenantSession\(\)/);
 assert.match(actions,/editStudentLesson\(db,session/);
 assert.match(service,/residentTenant\(tx,session\)/);
 assert.match(service,/STUDENT_LESSON_UPDATED/);
 assert.doesNotMatch(page,/residentStaff|db\.studentLesson\.findMany\(\{where:\{organizationId\}\}/);
});
