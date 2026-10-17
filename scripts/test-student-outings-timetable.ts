import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import type {PrismaClient} from "../src/generated/prisma/client";
import type {TenantSession} from "../src/lib/auth/tenant-session";
import type {SessionPayload} from "../src/lib/auth/session";
import {reportStudentOuting,recordStaffOutingResponse,outingAttention} from "../src/lib/student-outings";
import {addStudentLesson,changeStudentLesson,lessonOccurrences,dueLessonReminders} from "../src/lib/student-timetable";

const now=new Date("2026-10-17T08:00:00Z");
const tenant:TenantSession={
 organizationId:"hostel-A",studentId:"student-A",name:"Resident",sessionVersion:1,
};
const staff:SessionPayload={
 organizationId:"hostel-A",userId:"user-A",name:"Gate officer",role:"CARETAKER",sessionVersion:1,
};
const requestId="da4af348-d6c0-402f-bcaa-3e411b40c988";
function createFixture(options?:{enabled?:boolean;manyRooms?:boolean;dailyLimit?:boolean;
 staffActive?:boolean;lessonConflict?:boolean}){
 const audits:any[]=[],outings:any[]=[],lessons:any[]=[];
 const occupancy={id:"stay-A",room:{
  number:"54",propertyId:"property-A",property:{
   timeZone:"Africa/Nairobi",countryCode:"KE",
  },
 }};
 let updated=0;
 const student={id:"student-A",portalSessionVersion:1};
 const tx={
  $queryRaw:async()=>[],
  student:{findFirst:async({where}:any)=>{
   assert.equal(where.organizationId,"hostel-A");
   return options?.enabled===false?null:student;
  }},
  user:{findFirst:async({where}:any)=>{
   assert.equal(where.organizationId,"hostel-A");
   return options?.staffActive===false?null:{
     id:"user-A",role:"CARETAKER",sessionVersion:1,
   };
  }},
  occupancy:{findMany:async({where}:any)=>{
   assert.equal(where.organizationId,"hostel-A");
   return options?.manyRooms?[occupancy,occupancy]:[occupancy];
  }},
  studentOuting:{
   findUnique:async({where}:any)=>{
    assert.equal(where.organizationId_studentId_requestId.organizationId,"hostel-A");
    return outings.find(x=>x.requestId===where.organizationId_studentId_requestId.requestId)||null;
   },
   findFirst:async({where}:any)=>{
    assert.equal(where.organizationId,"hostel-A");
    if(where.id)return outings.find(o=>o.id===where.id)||null;
    return outings.find(o=>["OUT","RETURN_REPORTED"].includes(o.status))||null;
   },
   count:async()=>options?.dailyLimit?12:outings.length,
   create:async({data}:any)=>{
     const item={...data,id:"outing-"+(outings.length+1)};
     outings.push(item);return{id:item.id};
   },
   update:async({where,data}:any)=>{
    updated++;
    const old=outings.find(o=>o.id===where.id);assert(old);
    Object.assign(old,data);
    return old;
   },
  },
  studentLesson:{
   findFirst:async({where}:any)=>{
    assert.equal(where.organizationId,"hostel-A");
    return lessons.find(o=>o.id===where.id && o.active)||null;
   },
   findMany:async({where}:any)=>{
    assert.equal(where.organizationId,"hostel-A");
    return options?.lessonConflict?[{
      id:"existing",dayOfWeek:1,startMinutes:600,endMinutes:720,
      title:"Existing lecture",courseCode:null,venue:null,remindBeforeMinutes:15,
      reminderEnabled:true,timeZone:"Africa/Nairobi",propertyId:"property-A",
    }]:lessons.filter(l=>l.active);
   },
   create:async({data}:any)=>{
    const item={...data,id:"lesson-"+(lessons.length+1),active:true};
    lessons.push(item);return{id:item.id};
   },
   update:async({where,data}:any)=>{
    updated++;let item=lessons.find(l=>l.id===where.id);
    assert(item);Object.assign(item,data);return item;
   },
  },
  auditLog:{create:async({data}:any)=>{audits.push(data);return{};}},
 };
 const db={$transaction:async(fn:(client:any)=>Promise<unknown>)=>fn(tx)} as unknown as PrismaClient;
 return {db,audits,outings,lessons,get changes(){return updated;}};
}
const goOut={action:"GO_OUT",requestId,expectedReturnLocal:"2026-10-17T16:00"};

test("student self-reports departure but is never marked physically outside by GPS",async()=>{
 const f=createFixture();
 const r=await reportStudentOuting(f.db,tenant,goOut,now);
 assert.match(r.success??"",/self-reported/i);
 assert.equal(f.outings.length,1);
 assert.equal(f.outings[0].studentId,"student-A");
 assert.equal(f.outings[0].organizationId,"hostel-A");
 assert.equal(f.outings[0].propertyId,"property-A");
 assert.equal(f.outings[0].roomLabel,"54");
 assert.equal(f.outings[0].status,"OUT");
 assert.equal(f.outings[0].expectedReturnAt.toISOString(),"2026-10-17T13:00:00.000Z");
 assert.equal(f.outings[0].latitude,undefined);
 assert.equal(f.audits[0].action,"STUDENT_OUTING_REPORTED");
 assert.doesNotMatch(JSON.stringify(f.audits),/phone|latitude|longitude/);
 const repeated=await reportStudentOuting(f.db,tenant,goOut,now);
 assert.ok(repeated.success);
 assert.equal(f.outings.length,1);
 const separate=await reportStudentOuting(f.db,tenant,{
  ...goOut,requestId:"47c294fe-b3d8-45cf-a754-b1c3ab0b6358",
 },now);
 assert.match(separate.error??"",/already have an open outing/);
 assert.equal(f.outings.length,1);
});
test("student can request later arrival and then report coming back; only staff can certify gate",async()=>{
 const f=createFixture();
 await reportStudentOuting(f.db,tenant,goOut,now);
 const id=f.outings[0].id;
 const late=await reportStudentOuting(f.db,tenant,{
   action:"REPORT_LATE",outingId:id,expectedReturnLocal:"2026-10-17T17:00",
   note:"Late tutorial session",
 },new Date(now.getTime()+60000));
 assert.match(late.success??"",/not approval/);
 assert.equal(f.outings[0].expectedReturnAt.toISOString(),"2026-10-17T14:00:00.000Z");
 assert.equal(f.outings[0].initialExpectedReturnAt.toISOString(),"2026-10-17T13:00:00.000Z");
 assert.ok(f.outings[0].lateNotifiedAt instanceof Date);
 const att=outingAttention({
   ...f.outings[0],lateAcknowledgedAt:null,studentReturnedAt:null,
 },new Date("2026-10-17T15:00:00Z"));
 assert.equal(att.overdueUnconfirmed,true);
 assert.equal(att.lateNoticeUnacknowledged,true);
 const ack=await recordStaffOutingResponse(f.db,staff,{
   id,action:"ACKNOWLEDGE_LATE",verified:true,
   note:"Spoke with student and reviewed gate staffing",
 },new Date("2026-10-17T12:00:00Z"));
 assert.match(ack.success??"",/not.*guarantee|acknowledged/i);
 assert.equal(f.outings[0].lateAcknowledgedById,staff.userId);
 const studentReturn=await reportStudentOuting(f.db,tenant,{
   action:"REPORT_RETURN",outingId:id,note:"",
 },new Date("2026-10-17T14:00:00Z"));
 assert.match(studentReturn.success??"",/NOT yet a verified arrival/);
 assert.equal(f.outings[0].status,"RETURN_REPORTED");
 assert.equal(f.outings[0].verifiedReturnAt,undefined);
 const invalid=await recordStaffOutingResponse(f.db,staff,{
   id,action:"VERIFY_RETURN",verified:false,note:"Saw student at the gate",
 },new Date("2026-10-17T14:01:00Z"));
 assert.ok(invalid.error);
 assert.equal(f.outings[0].status,"RETURN_REPORTED");
 const verify=await recordStaffOutingResponse(f.db,staff,{
   id,action:"VERIFY_RETURN",verified:true,note:"Personally confirmed student's arrival at the gate",
 },new Date("2026-10-17T14:03:00Z"));
 assert.match(verify.success??"",/verified return/);
 assert.equal(f.outings[0].status,"VERIFIED_RETURN");
 assert.equal(f.outings[0].verifiedById,staff.userId);
 assert.equal(f.audits.at(-1).action,"STUDENT_GATE_RETURN_VERIFIED");
});
test("revoked student, invalid deadlines, reused room and revoked gate access fail closed",async()=>{
 const none=createFixture({enabled:false});
 assert.match((await reportStudentOuting(none.db,tenant,goOut,now)).error??"",/current|active/);
 assert.equal(none.outings.length,0);
 const rooms=createFixture({manyRooms:true});
 assert.match((await reportStudentOuting(rooms.db,tenant,goOut,now)).error??"",/room/);
 const f=createFixture();
 for(const local of ["2026-10-17T10:00","2026-10-25T10:00","bad"]){
  assert.ok((await reportStudentOuting(f.db,tenant,{
    ...goOut,expectedReturnLocal:local,
  },now)).error);
 }
 assert.equal(f.outings.length,0);
 await reportStudentOuting(f.db,tenant,goOut,now);
 const untrusted=await recordStaffOutingResponse(createFixture({staffActive:false}).db,staff,{
   id:"anything",action:"ACKNOWLEDGE_LATE",verified:true,note:"I checked the late report",
 },now);
 assert.ok(untrusted.error);
 const missingStaff=await recordStaffOutingResponse(f.db,null,{
  id:f.outings[0].id,action:"VERIFY_RETURN",verified:true,note:"I saw a resident",
 },now);
 assert.ok(missingStaff.error);
 const invalidLate=await reportStudentOuting(f.db,tenant,{
  action:"REPORT_LATE",outingId:f.outings[0].id,
  expectedReturnLocal:"2026-10-17T15:00",note:"Wrong earlier time",
 },now);
 assert.ok(invalidLate.error);
});
test("late updates are not mandatory location disclosure or automatic after-hours permission",()=>{
 const source=readFileSync("src/lib/student-outings.ts","utf8");
 const gate=readFileSync("src/app/(app)/outings/page.tsx","utf8");
 const student=readFileSync("src/components/student-movement-forms.tsx","utf8");
 assert.doesNotMatch(source,/latitude|longitude|watchPosition|geolocation/);
 assert.match(gate,/residentStaff/);
 assert.match(gate,/overdueUnconfirmed/);
 assert.match(gate,/verified return|verify actual|actual arrival/i);
 assert.match(student,/late-return notice/);
 assert.match(student,/not automatically authorize|not approval|not automatically grant/i);
});

const lesson={
 title:"Advanced Algebra",courseCode:"MAT 201",venue:"Hall B",
 dayOfWeek:1,startTime:"09:00",endTime:"10:00",
 remindBeforeMinutes:15,reminderEnabled:true,
};
test("student alone writes private weekly timetable with property timezone, no owner access",async()=>{
 const f=createFixture();
 const r=await addStudentLesson(f.db,tenant,lesson);
 assert.match(r.success??"",/private weekly timetable/);
 assert.equal(f.lessons.length,1);
 const row=f.lessons[0];
 assert.equal(row.organizationId,"hostel-A");
 assert.equal(row.studentId,"student-A");
 assert.equal(row.timeZone,"Africa/Nairobi");
 assert.equal(row.startMinutes,540);
 assert.equal(row.endMinutes,600);
 assert.equal(row.remindBeforeMinutes,15);
 const repeated=await addStudentLesson(f.db,tenant,lesson);
 assert.ok(repeated.success);
 assert.equal(f.lessons.length,1);
 assert.equal(f.audits[0].action,"STUDENT_LESSON_ADDED");
});
test("timetable rejects overlapping lessons and invalid time inputs",async()=>{
 const f=createFixture({lessonConflict:true});
 assert.match((await addStudentLesson(f.db,tenant,{
  ...lesson,startTime:"10:30",endTime:"11:30",
 })).error??"",/overlaps/);
 assert.equal(f.lessons.length,0);
 for(const input of [
  {...lesson,startTime:"10:00",endTime:"09:00"},
  {...lesson,startTime:"09:00",endTime:"19:00"},
  {...lesson,dayOfWeek:7},
  {...lesson,remindBeforeMinutes:999},
 ]){
  assert.ok((await addStudentLesson(f.db,tenant,input)).error);
 }
});
test("student toggles and removes their own timetable entry",async()=>{
 const f=createFixture();
 await addStudentLesson(f.db,tenant,lesson);
 const id=f.lessons[0].id;
 assert.match((await changeStudentLesson(f.db,tenant,{id,action:"REMIND_OFF"})).success??"",/disabled/);
 assert.equal(f.lessons[0].reminderEnabled,false);
 assert.ok((await changeStudentLesson(f.db,tenant,{id,action:"REMIND_ON"})).success);
 assert.equal(f.lessons[0].reminderEnabled,true);
 assert.ok((await changeStudentLesson(f.db,tenant,{id,action:"REMOVE"})).success);
 assert.equal(f.lessons[0].active,false);
 assert.equal(f.lessons[0].reminderEnabled,false);
 assert.ok((await changeStudentLesson(f.db,tenant,{id,action:"REMIND_ON"})).error);
});
test("property-local class time computes next class and both pre/start push windows",()=>{
 const row={
  id:"L1",organizationId:"hostel-A",studentId:"student-A",
  propertyId:"property-A",title:"Algebra",venue:"Hall B",courseCode:"MAT 201",
  dayOfWeek:1,startMinutes:540,endMinutes:600,timeZone:"Africa/Nairobi",
  remindBeforeMinutes:15,reminderEnabled:true,active:true,
 };
 const monday=new Date("2026-10-19T05:46:00Z");
 const upcoming=lessonOccurrences([row],monday,8);
 assert.equal(upcoming[0].startAt.toISOString(),"2026-10-19T06:00:00.000Z");
 assert.equal(upcoming[0].endAt.toISOString(),"2026-10-19T07:00:00.000Z");
 assert.equal(dueLessonReminders([row],monday)[0]?.kind,"PREP");
 assert.equal(dueLessonReminders([row],new Date("2026-10-19T06:02:00Z"))[0]?.kind,"START");
 assert.equal(dueLessonReminders([row],new Date("2026-10-19T07:00:00Z")).length,0);
 assert.equal(dueLessonReminders([{...row,reminderEnabled:false}],monday).length,0);
 const kathmandu={...row,timeZone:"Asia/Kathmandu"};
 assert.equal(lessonOccurrences([kathmandu],new Date("2026-10-18T23:00:00Z"),8)[0].startAt.toISOString(),
   "2026-10-19T03:15:00.000Z");
});
test("DST gap/ambiguity, invalid schedule and inactive class do not produce false occurrences",()=>{
 const row={
  id:"L1",organizationId:"hostel-A",studentId:"student-A",
  propertyId:"property-A",title:"Lab",venue:null,courseCode:null,
  dayOfWeek:0,startMinutes:150,endMinutes:210,
  timeZone:"America/New_York",remindBeforeMinutes:15,reminderEnabled:true,active:true,
 };
 const gap=lessonOccurrences([row],new Date("2026-03-08T05:00:00Z"),1);
 assert.equal(gap.length,0);
 assert.equal(lessonOccurrences([{...row,active:false}],new Date("2026-03-08T05:00:00Z"),8).length,0);
 assert.equal(lessonOccurrences([{...row,timeZone:"Invalid/Zone"}],now,8).length,0);
});
test("app routes enforce private student schedule and security-only outing activity",()=>{
 const tenantPage=readFileSync("src/app/tenant/timetable/page.tsx","utf8");
 const securityPage=readFileSync("src/app/(app)/outings/page.tsx","utf8");
 const push=readFileSync("src/lib/push-service.ts","utf8");
 const worker=readFileSync("public/hostel-sw.js","utf8");
 assert.match(tenantPage,/requireTenantSession/);
 assert.match(tenantPage,/studentId:studentId|organizationId,studentId/);
 assert.match(securityPage,/residentStaff/);
 assert.doesNotMatch(securityPage,/studentLesson\.findMany/);
 assert.match(push,/dueLessonReminders/);
 assert.match(push,/studentLesson\.findMany/);
 assert.match(push,/studentOuting\.findMany/);
 assert.match(push,/kind:"CLASS_REMINDER"/);
 assert.match(push,/kind:"GATE_UPDATE"/);
 assert.match(worker,/\/tenant\/timetable/);
 assert.match(worker,/\/outings/);
 assert.match(worker,/allowedAlertRoute/);
 assert.doesNotMatch(tenantPage,/studentOuting\.findMany\(\{where:\{organizationId\}\}/);
});
