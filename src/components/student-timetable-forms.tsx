"use client";
import {useActionState,useEffect} from "react";
import {useRouter} from "next/navigation";
import {addLessonAction,changeLessonAction} from "@/app/tenant/timetable/actions";

export function TimetableAddForm({timeZone}:{timeZone:string}){
 const [state,action,pending]=useActionState(addLessonAction,{});
 const router=useRouter();
 useEffect(()=>{if(state.success)router.refresh();},[state.success,router]);
 return <form action={action} className="panel entity-form">
   <h2>Add a weekly class</h2>
   <p>Use your university timetable. All class times below are in the hostel's displayed
      time zone ({timeZone}). Lessons are private to you; security staff cannot read your classes.</p>
   <label className="field-group"><span>Class / subject *</span>
     <input name="title" required minLength={3} maxLength={100}
       placeholder="e.g. Mathematics lecture"/></label>
   <label className="field-group"><span>Course code (optional)</span>
     <input name="courseCode" maxLength={30} placeholder="e.g. MAT 101"/></label>
   <label className="field-group"><span>Class location / room (optional)</span>
     <input name="venue" maxLength={100} placeholder="e.g. Lecture Hall B"/></label>
   <label className="field-group"><span>Day of week *</span>
     <select name="dayOfWeek" defaultValue="1">
       <option value="1">Monday</option><option value="2">Tuesday</option>
       <option value="3">Wednesday</option><option value="4">Thursday</option>
       <option value="5">Friday</option><option value="6">Saturday</option>
       <option value="0">Sunday</option>
     </select>
   </label>
   <div className="room-summary-grid">
     <label className="field-group"><span>Class starts *</span>
       <input type="time" name="startTime" required defaultValue="08:00"/></label>
     <label className="field-group"><span>Class ends *</span>
       <input type="time" name="endTime" required defaultValue="10:00"/></label>
   </div>
   <label className="field-group"><span>Alert before the lesson *</span>
     <select name="remindBeforeMinutes" defaultValue="15">
       <option value="0">At class start</option>
       <option value="10">10 minutes before</option>
       <option value="15">15 minutes before</option>
       <option value="30">30 minutes before</option>
       <option value="60">1 hour before</option>
     </select>
   </label>
   <label className="check-field">
     <input type="checkbox" name="reminderEnabled" defaultChecked/>
     Remind me for this weekly lesson.
   </label>
   <button className="primary-button" disabled={pending}>
     {pending?"Saving class…":"Add to my timetable"}
   </button>
   {state.error?<p className="form-error" role="alert">{state.error}</p>:null}
   {state.success?<p className="form-success" role="status">{state.success}</p>:null}
 </form>;
}

export function TimetableLessonControls({id,enabled}:{id:string;enabled:boolean}){
 const [state,action,pending]=useActionState(changeLessonAction,{});
 const router=useRouter();
 useEffect(()=>{if(state.success)router.refresh();},[state.success,router]);
 return <form action={action} className="entity-form">
   <input name="id" type="hidden" value={id}/>
   <div className="heading-actions">
     <button className="secondary-button" name="action"
       value={enabled?"REMIND_OFF":"REMIND_ON"} disabled={pending}>
       {enabled?"Pause reminders":"Enable reminders"}
     </button>
     <button className="secondary-button" name="action"
       value="REMOVE" disabled={pending}>Remove class</button>
   </div>
   {state.error?<p className="form-error" role="alert">{state.error}</p>:null}
   {state.success?<p className="form-success" role="status">{state.success}</p>:null}
 </form>;
}
