import type {PrismaClient} from "@/generated/prisma/client";
const link=(title:string,href:string,action:string)=>({title,href,action});
/**
 * Report only student-provided genders. Null is UNKNOWN, not a classification
 * and not a "male" or "female" inferred from name or hostel accommodation.
 */
export async function answerStudentGenderReport(db:PrismaClient,organizationId:string) {
 const counts=await db.student.groupBy({
  by:["gender"],where:{organizationId,status:"ACTIVE"},_count:{_all:true}
 });
 const by=new Map(counts.map(r=>[r.gender,r._count._all]));
 const male=by.get("MALE")??0,female=by.get("FEMALE")??0;
 const other=by.get("OTHER")??0,declined=by.get("PREFER_NOT_TO_SAY")??0;
 const unrecorded=by.get(null)??0;
 const total=male+female+other+declined+unrecorded;
 const intro="Current active student register — self-reported gender statistics:";
 const detail="\nMale: "+male+"\nFemale: "+female+"\nOther: "+other+
   "\nPrefer not to disclose: "+declined+"\nNot recorded: "+unrecorded+"\nTotal active students: "+total;
 const note=unrecorded===total&&total>0
  ?"\nGender has not been recorded for the active students. The zero counts above do NOT establish that the hostel has no male or female students."
  :unrecorded>0?"\nThese counts describe only students whose gender was recorded. "+unrecorded+" students are not classified; complete male/female totals are therefore unknown."
  :"\nCounts reflect recorded choices and may differ from actual attendance. Students may decline to provide this optional detail.";
 return {mode:"records" as const,text:intro+detail+note+
  "\nNo student's gender has been guessed from a name, room or photograph. No records were changed.",
  links:[link("Student register","/students","Review student details")]
 };
}
