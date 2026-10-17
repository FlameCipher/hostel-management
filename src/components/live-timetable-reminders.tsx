"use client";
import {useEffect,useRef,useState} from "react";

type Lesson={
 id:string;title:string;startAt:string;endAt:string;timeZone:string;
 remindBeforeMinutes:number;reminderEnabled:boolean;
};
export function LiveTimetableReminders({lessons}:{lessons:Lesson[]}){
 const [now,setNow]=useState(0),[permission,setPermission]=useState("unknown");
 const [error,setError]=useState("");
 const shown=useRef(new Set<string>());
 useEffect(()=>{
   setNow(Date.now());
   if(typeof Notification!=="undefined")setPermission(Notification.permission);
   const tick=window.setInterval(()=>setNow(Date.now()),30000);
   return ()=>window.clearInterval(tick);
 },[]);
 useEffect(()=>{
   if(!now||permission!=="granted"||typeof Notification==="undefined")return;
   for(const lesson of lessons){
     if(!lesson.reminderEnabled)continue;
     const start=Date.parse(lesson.startAt);
     const before=start-lesson.remindBeforeMinutes*60000;
     const isNear=lesson.remindBeforeMinutes>0&&now>=before&&now<before+6*60000&&now<start;
     const isStart=now>=start&&now<start+6*60000;
     const event=isStart?"START":isNear?"PREP":null;
     if(!event)continue;
     const key=lesson.id+":"+lesson.startAt+":"+event;
     if(shown.current.has(key))continue;
     shown.current.add(key);
     try{
       // No course, student, or room details are exposed on device lock screens.
       new Notification(event==="START"?"Class starting now":"Class reminder",{
         body:"Open your private hostel timetable to review your next lesson.",
         tag:key,
       });
     }catch{
       setError("Browser notification could not be shown. Check the timetable directly.");
     }
   }
 },[lessons,now,permission]);
 async function enable(){
   if(typeof Notification==="undefined"){
     setError("Browser notifications are unavailable on this device. Keep the timetable open for visible alerts.");return;
   }
   try{
     const result=await Notification.requestPermission();
     setPermission(result);
     if(result!=="granted")setError("Notifications not permitted. Timetable alerts remain visible while this page is open.");
     else setError("");
   }catch{
     setError("Your browser could not enable notifications.");
   }
 }
 const active=lessons.filter(item=>item.reminderEnabled&&now>0&&
   now>=Date.parse(item.startAt)-item.remindBeforeMinutes*60000&&
   now<Date.parse(item.endAt)).slice(0,3);
 return <section className="panel entity-form" aria-label="Live class reminders">
   <h2>Today's class alerts</h2>
   <p>Lessons nearing their start appear here automatically while this page is open.</p>
   {active.length?active.map(item=>{
     const started=now>=Date.parse(item.startAt);
     return <p key={item.id} role="status"><strong>
       {started?"Class in progress":"Class coming up"}: {item.title}
     </strong> · {new Date(item.startAt).toLocaleTimeString("en-GB",{
       timeZone:item.timeZone,hour:"2-digit",minute:"2-digit"
     })} ({item.timeZone})</p>;
   }):<p>No active class reminder right now. This is not an attendance check.</p>}
   <button type="button" className="secondary-button" onClick={()=>void enable()}>
     {permission==="granted"?"Browser notifications enabled":"Enable alerts while this page is open"}
   </button>
   <p className="muted-note">These browser alerts require this page to stay open.
     Background push reminders depend on a separate, opted-in device subscription,
     an installed compatible hostel app, provider configuration and successful delivery;
     they are not guaranteed. Class timetable details stay private.</p>
   {error?<p role="alert" className="form-error">{error}</p>:null}
 </section>;
}
