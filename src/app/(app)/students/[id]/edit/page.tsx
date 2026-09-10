import { notFound, redirect } from "next/navigation";
import { StudentForm } from "@/components/student-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/students");
  const { id } = await params;
  const student = await db.student.findFirst({ where: { id, organizationId: session.organizationId }, include: { guardian: true } });
  if (!student) notFound();

  return (
    <div className="form-page">
      <div className="page-heading-row"><div><p className="eyebrow">Student register</p><h1>Edit student</h1><p>Update student and guardian information.</p></div></div>
      <StudentForm student={{
        id: student.id, fullName: student.fullName, phone: student.phone, university: student.university,
        admissionNumber: student.admissionNumber ?? "", nationalId: student.nationalId ?? "",
        admittedAt: student.admittedAt.toISOString().slice(0, 10), status: student.status, notes: student.notes ?? "",
        guardianName: student.guardian?.name ?? "", guardianPhone: student.guardian?.phone ?? "",
        guardianRelationship: student.guardian?.relationship ?? "", guardianEmail: student.guardian?.email ?? "",
      }} />
    </div>
  );
}
