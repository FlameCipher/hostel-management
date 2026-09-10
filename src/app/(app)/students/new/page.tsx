import { redirect } from "next/navigation";
import { StudentForm } from "@/components/student-form";
import { requireSession } from "@/lib/auth/session";

export default async function NewStudentPage() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/students");
  return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Student register</p><h1>Add a student</h1><p>Record the student’s JKUAT and guardian details before room allocation.</p></div></div><StudentForm /></div>;
}
