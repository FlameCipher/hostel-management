"use server";
import {revalidatePath} from "next/cache";
import {requireTenantSession} from "@/lib/auth/tenant-session";
import {db} from "@/lib/db";
import {addStudentLesson,changeStudentLesson,editStudentLesson} from "@/lib/student-timetable";
export type TimetableState={success?:string;error?:string};
export async function addLessonAction(_state:TimetableState,form:FormData):Promise<TimetableState>{
 const session=await requireTenantSession();
 try{
  const result=await addStudentLesson(db,session,{
   title:form.get("title"),courseCode:form.get("courseCode")??"",
   venue:form.get("venue")??"",dayOfWeek:form.has("dayOfWeek")?Number(form.get("dayOfWeek")):-1,
   startTime:form.get("startTime"),endTime:form.get("endTime"),
   remindBeforeMinutes:form.has("remindBeforeMinutes")?Number(form.get("remindBeforeMinutes")):-1,
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


/** The resident changes an existing private lesson, never another person's timetable. */
export async function editLessonAction(_state:TimetableState,form:FormData):Promise<TimetableState>{
 const session=await requireTenantSession();
 try{
  const result=await editStudentLesson(db,session,{
   id:form.get("id"),title:form.get("title"),
   courseCode:form.get("courseCode")??"",venue:form.get("venue")??"",
   dayOfWeek:form.has("dayOfWeek")?Number(form.get("dayOfWeek")):-1,
   startTime:form.get("startTime"),endTime:form.get("endTime"),
   remindBeforeMinutes:form.has("remindBeforeMinutes")?Number(form.get("remindBeforeMinutes")):-1,
   reminderEnabled:form.get("reminderEnabled")==="on",
  });
  revalidatePath("/tenant/timetable");
  return result;
 }catch{return {error:"Could not confirm the class changes. Check your current timetable and retry safely."};}
}
