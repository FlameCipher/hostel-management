import { redirect } from "next/navigation";
import { StudentForm } from "@/components/student-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function NewStudentPage() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/students");
  const [roomTypes, semesters] = await Promise.all([
    db.roomType.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { name: "asc" } }),
    db.semester.findMany({ where: { organizationId: session.organizationId, status: "ACTIVE" }, orderBy: { startDate: "desc" } }),
  ]);
  return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Student intake</p><h1>Add a student</h1><p>Register personal details, select accommodation, then collect the initial payment before assigning a room.</p></div></div><StudentForm roomTypes={roomTypes.map((type) => ({ id: type.id, label: `${type.name} · KES ${Number(type.semesterRate).toLocaleString("en-KE")}/semester` }))} semesters={semesters.map((semester) => ({ id: semester.id, label: semester.name }))} /></div>;
}
