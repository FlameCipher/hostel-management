import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantSession } from "./auth/tenant-session";
import { residentTenant } from "./resident-access";
import { hostelTimeZone, visitLocalTime } from "./resident-policy";

const lessonSchema=z.object({
 title:z.string().trim().min(3).max(100),
 courseCode:z.string().trim().max(30).default(""),
 venue:z.string().trim().max(100).default(""),
 dayOfWeek:z.number().int().min(0).max(6),
 startTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
 endTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
 remindBeforeMinutes:z.union([z.literal(0),z.literal(10),z.literal(15),z.literal(30),z.literal(60)]),
 reminderEnabled:z.boolean(),
});
const changeSchema=z.object({
 id:z.string().min(1).max(128),
 action:z.enum(["REMOVE","REMIND_ON","REMIND_OFF"]),
});
const MINUTE_MS=60000,DAY_MS=86400000;
export const lessonDayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;
export const lessonMinutes=(hhmm:string)=>
 Number(hhmm.slice(0,2))*60+Number(hhmm.slice(3,5));
export const clockMinutes=(minutes:number)=>
 String(Math.floor(minutes/60)).padStart(2,"0")+":"+
 String(minutes%60).padStart(2,"0");

export type TimetableLesson={
 id:string;organizationId:string;studentId:string;propertyId:string;
 title:string;courseCode:string|null;venue:string|null;
 dayOfWeek:number;startMinutes:number;endMinutes:number;timeZone:string;
 remindBeforeMinutes:number;reminderEnabled:boolean;active:boolean;
};
export type LessonOccurrence={
 lessonId:string;organizationId:string;studentId:string;propertyId:string;
 title:string;venue:string|null;courseCode:string|null;
 timeZone:string;startAt:Date;endAt:Date;localDate:string;
 remindBeforeMinutes:number;reminderEnabled:boolean;
};
function dateLocalParts(now:Date,zone:string) {
 try {
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(now);
  const get=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
  const [year,month,day]=[get("year"),get("month"),get("day")];
  if(!year||!month||!day)return null;
  return Date.UTC(year,month-1,day);
 }catch{return null;}
}

/** Property-local weekly scheduling. No class attendance or whereabouts are inferred. */
export function lessonOccurrences(
 lessons:readonly TimetableLesson[],now:Date,daysAhead=8,
):LessonOccurrence[]{
 const result:LessonOccurrence[]=[];
 for(const lesson of lessons){
  if(!lesson.active || lesson.dayOfWeek<0 || lesson.dayOfWeek>6 ||
    lesson.startMinutes<0||lesson.endMinutes>1440||
    lesson.endMinutes<=lesson.startMinutes)continue;
  const localStart=dateLocalParts(now,lesson.timeZone);
  if(localStart===null)continue;
  for(let offset=0;offset<daysAhead;offset++){
   const utcDay=new Date(localStart+offset*DAY_MS);
   if(utcDay.getUTCDay()!==lesson.dayOfWeek)continue;
   const date=utcDay.toISOString().slice(0,10);
   const first=visitLocalTime(date+"T"+clockMinutes(lesson.startMinutes),lesson.timeZone);
   const last=visitLocalTime(date+"T"+clockMinutes(lesson.endMinutes),lesson.timeZone);
   if(!first||!last||last<=first||last.getTime()<now.getTime()-10*MINUTE_MS)continue;
   result.push({
     lessonId:lesson.id,organizationId:lesson.organizationId,
     studentId:lesson.studentId,propertyId:lesson.propertyId,
     title:lesson.title,venue:lesson.venue,courseCode:lesson.courseCode,
     timeZone:lesson.timeZone,startAt:first,endAt:last,localDate:date,
     remindBeforeMinutes:lesson.remindBeforeMinutes,
     reminderEnabled:lesson.reminderEnabled,
   });
  }
 }
 return result.sort((a,b)=>a.startAt.getTime()-b.startAt.getTime()
   ||a.lessonId.localeCompare(b.lessonId));
}

export function dueLessonReminders(lessons:readonly TimetableLesson[],now:Date) {
 const upcoming=lessonOccurrences(lessons,now,2);
 const due:Array<{occurrence:LessonOccurrence;kind:"PREP"|"START"}>=[];
 for(const occurrence of upcoming){
  if(!occurrence.reminderEnabled)continue;
  if(occurrence.remindBeforeMinutes>0){
   const at=occurrence.startAt.getTime()-occurrence.remindBeforeMinutes*MINUTE_MS;
   if(now.getTime()>=at&&now.getTime()<at+6*MINUTE_MS &&
     now.getTime()<occurrence.startAt.getTime())due.push({occurrence,kind:"PREP"});
  }
  const start=occurrence.startAt.getTime();
  if(now.getTime()>=start&&now.getTime()<start+6*MINUTE_MS)
   due.push({occurrence,kind:"START"});
 }
 return due;
}

export async function addStudentLesson(db:PrismaClient,session:TenantSession|null,raw:unknown):Promise<{error?:string;success?:string}> {
 if(!session)return {error:"Student sign-in is required."};
 const parsed=lessonSchema.safeParse(raw);
 if(!parsed.success)return {error:"Enter a class name, valid day and times, and a supported reminder interval."};
 const input=parsed.data,start=lessonMinutes(input.startTime),end=lessonMinutes(input.endTime);
 if(end<=start ||end-start>8*60)
   return {error:"Class must finish after it starts and must not exceed eight hours."};
 const org=session.organizationId,studentId=session.studentId;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${studentId} AND "organizationId"=${org} FOR UPDATE`;
  if(!await residentTenant(tx,session))return {error:"Only a current resident may save a private class timetable."};
  const stays=await tx.occupancy.findMany({
    where:{organizationId:org,studentId,status:"ACTIVE",semester:{organizationId:org},
      room:{organizationId:org,property:{organizationId:org,active:true}}},
    select:{room:{select:{propertyId:true,property:{select:{
      timeZone:true,countryCode:true,
    }}}}},take:2,
  });
  if(stays.length!==1)return {error:"Your current hostel property is ambiguous. Contact management."};
  const propertyId=stays[0].room.propertyId;
  const timeZone=hostelTimeZone(stays[0].room.property.timeZone,
    stays[0].room.property.countryCode);
  const others=await tx.studentLesson.findMany({
    where:{organizationId:org,studentId,active:true},
    select:{id:true,dayOfWeek:true,startMinutes:true,endMinutes:true,
      title:true,courseCode:true,venue:true,remindBeforeMinutes:true,
      reminderEnabled:true,timeZone:true,propertyId:true},
    take:61,
  });
  if(others.length>=60)return {error:"Maximum 60 active classes per student. Remove old lessons first."};
  const duplicate=others.some(o=>o.dayOfWeek===input.dayOfWeek &&
    o.startMinutes===start&&o.endMinutes===end&&
    o.title.toLocaleLowerCase()===input.title.toLocaleLowerCase());
  if(duplicate)return {success:"This class is already on your timetable."};
  if(others.some(o=>o.dayOfWeek===input.dayOfWeek &&
    start<o.endMinutes&&end>o.startMinutes))
    return {error:"A different class overlaps this time. Edit your timetable before adding it."};
  const lesson=await tx.studentLesson.create({data:{
    organizationId:org,studentId,propertyId,title:input.title,
    courseCode:input.courseCode||null,venue:input.venue||null,
    dayOfWeek:input.dayOfWeek,startMinutes:start,endMinutes:end,timeZone,
    remindBeforeMinutes:input.remindBeforeMinutes,
    reminderEnabled:input.reminderEnabled,
  },select:{id:true}});
  await tx.auditLog.create({data:{organizationId:org,action:"STUDENT_LESSON_ADDED",
    entityType:"StudentLesson",entityId:lesson.id}});
  return {success:"Class saved to your private weekly timetable. Reminders require this page or an explicitly enabled device push subscription."};
 },{timeout:15000});
}

export async function changeStudentLesson(db:PrismaClient,session:TenantSession|null,raw:unknown):Promise<{error?:string;success?:string}> {
 if(!session)return {error:"Student sign-in required."};
 const parsed=changeSchema.safeParse(raw);
 if(!parsed.success)return {error:"Choose a valid timetable action."};
 const input=parsed.data,org=session.organizationId,studentId=session.studentId;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${studentId} AND "organizationId"=${org} FOR UPDATE`;
  if(!await residentTenant(tx,session))return {error:"Private timetable is unavailable."};
  const row=await tx.studentLesson.findFirst({where:{
    id:input.id,organizationId:org,studentId,active:true,
  },select:{id:true}});
  if(!row)return {error:"Class is unavailable or already removed."};
  const data=input.action==="REMOVE"?{active:false,reminderEnabled:false}
    :{reminderEnabled:input.action==="REMIND_ON"};
  await tx.studentLesson.update({where:{id:row.id},data});
  await tx.auditLog.create({data:{organizationId:org,
    action:input.action==="REMOVE"?"STUDENT_LESSON_REMOVED":"STUDENT_LESSON_REMINDER_CHANGED",
    entityType:"StudentLesson",entityId:row.id,metadata:{action:input.action}}});
  return {success:input.action==="REMOVE"?"Class removed from your timetable.":
    input.action==="REMIND_ON"?"Reminders enabled for this class.":"Reminders disabled for this class."};
 },{timeout:15000});
}
