import Link from "next/link";
import {requireTenantSession} from "@/lib/auth/tenant-session";
import {residentTenant} from "@/lib/resident-access";
import {db} from "@/lib/db";
import {hostelTimeZone} from "@/lib/resident-policy";
import {lessonDayNames,clockMinutes,lessonOccurrences} from "@/lib/student-timetable";
import {TimetableAddForm,TimetableLessonControls} from "@/components/student-timetable-forms";
import {LiveTimetableReminders} from "@/components/live-timetable-reminders";
import {DeviceReminderOptIn} from "@/components/device-reminder-optin";

export const dynamic="force-dynamic";
export const metadata={title:"My class timetable",robots:{index:false,follow:false}};

export default async function TenantTimetablePage(){
 const session=await requireTenantSession();
 if(!await residentTenant(db,session))return <main className="marketing-section">
   <h1>My timetable</h1><p>Sign in to a current hostel student account to manage your own classes.</p>
   <Link href="/tenant/account">My portal</Link>
 </main>;
 const organizationId=session.organizationId,studentId=session.studentId,now=new Date();
 const [lessons,stays]=await Promise.all([
   db.studentLesson.findMany({where:{organizationId,studentId,active:true},
     select:{id:true,organizationId:true,studentId:true,propertyId:true,title:true,
       courseCode:true,venue:true,dayOfWeek:true,startMinutes:true,endMinutes:true,
       timeZone:true,remindBeforeMinutes:true,reminderEnabled:true,active:true},
     orderBy:[{dayOfWeek:"asc"},{startMinutes:"asc"},{id:"asc"}],take:60}),
   db.occupancy.findMany({where:{organizationId,studentId,status:"ACTIVE",
     semester:{organizationId},room:{organizationId,property:{organizationId,active:true}}},
     select:{room:{select:{property:{select:{name:true,timeZone:true,countryCode:true}}}}},take:2}),
 ]);
 const currentProperty=stays[0]?.room.property;
 const timeZone=hostelTimeZone(currentProperty?.timeZone,currentProperty?.countryCode);
 const upcoming=lessonOccurrences(lessons,now,8).slice(0,20);
 const localDate=(date:Date,zone:string)=>date.toLocaleString("en-KE",
   {timeZone:zone,weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
 return <main className="marketing-section">
   <div className="page-heading-row"><div>
     <p className="eyebrow">Student academic planner</p>
     <h1>My class timetable</h1>
     <p>Your private weekly lesson schedule, reminders and study planning.</p>
   </div><Link href="/tenant/account" className="secondary-button">My portal</Link></div>
   <section className="panel entity-form mt-5">
     <h2>My next lessons</h2>
     {upcoming.length?upcoming.map(item=><p key={item.lessonId+":"+item.localDate}>
       <strong>{item.title}</strong>
       {item.courseCode?" · "+item.courseCode:""}
       · {localDate(item.startAt,item.timeZone)}
       {item.venue?" · "+item.venue:""}
     </p>):<p>No upcoming classes in this week's recorded timetable.</p>}
   </section>
   <LiveTimetableReminders lessons={upcoming.map(x=>({
     id:x.lessonId,title:x.title,startAt:x.startAt.toISOString(),
     endAt:x.endAt.toISOString(),timeZone:x.timeZone,
     remindBeforeMinutes:x.remindBeforeMinutes,reminderEnabled:x.reminderEnabled,
   }))}/>
   {stays.length===1?<TimetableAddForm timeZone={timeZone}/>:
     <section className="panel entity-form">
       <h2>Cannot assign a timetable time zone</h2>
       <p>Your current hostel allocation needs management review before adding classes.</p>
     </section>}
   <section className="panel entity-form mt-5">
     <h2>My weekly classes ({lessons.length})</h2>
     <p>Remove past classes or pause individual reminders. This timetable is for
       your personal planning—not a university attendance or hostel location record.</p>
     {lessons.length?lessons.map(item=><article className="panel entity-form mt-4" key={item.id}>
       <h3>{item.title}{item.courseCode?" · "+item.courseCode:""}</h3>
       <p>{lessonDayNames[item.dayOfWeek]} · {clockMinutes(item.startMinutes)}
         –{clockMinutes(item.endMinutes)} ({item.timeZone})
         {item.venue?" · "+item.venue:""}</p>
       <p>{item.reminderEnabled?
         `Reminder ${item.remindBeforeMinutes} minutes before class, plus when it starts.`:
         "Reminders paused for this class."}</p>
       <TimetableLessonControls id={item.id} enabled={item.reminderEnabled}/>
     </article>):<p>No classes added yet.</p>}
   </section>
   <DeviceReminderOptIn audience="tenant"/>
   <section className="panel entity-form mt-5">
     <h2>How class reminders work</h2>
     <p>The page shows near-term lessons as it remains open. Compatible devices may
       additionally receive optional push reminders if notifications are enabled
       and configured; provider acceptance is not proof the alert was read.
       University timetable changes must be updated by you.</p>
     <Link href="/install" className="secondary-button">Install my hostel app</Link>
   </section>
 </main>;
}
