"use server";
import {revalidatePath} from "next/cache";
import {requireTenantSession} from "@/lib/auth/tenant-session";
import {db} from "@/lib/db";
import {addStudentLesson,changeStudentLesson} from "@/lib/student-timetable";
export type TimetableState={success?:string;error?:string};
export async function addLessonAction(_state:TimetableState,form:FormData):Promise<TimetableState>{
 const session=await requireTenantSession();
 try{
  const result=await addStudentLesson(db,session,{
   title:form.get("title"),courseCode:form.get("courseCode")??"",
   venue:form.get("venue")??"",dayOfWeek:Number(form.get("dayOfWeek")),
   startTime:form.get("startTime"),endTime:form.get("endTime"),
   remindBeforeMinutes:Number(form.get("remindBeforeMinutes")),
   reminderEnabled:form.get("reminderEnabled")==="on",
  });
  revalidatePath("/tenant/timetable");return result;
 }catch{return {error:"Could not save your class. Refresh the timetable before retrying."};}
}
export async function changeLessonAction(_state:TimetableState,form:FormData):Promise<TimetableState>{
 const session=await requireTenantSession();
 try{
  const result=await changeStudentLesson(db,session,{id:form.get("id"),action:form.get("action")});
  revalidatePath("/tenant/timetable");return result;
 }catch{return {error:"Class update could not be confirmed. Please check the timetable."};}
}
