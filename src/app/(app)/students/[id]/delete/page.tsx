import { notFound, redirect } from "next/navigation";
import { DeleteStudentForm } from "@/components/delete-student-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function DeleteStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!["OWNER", "ADMIN"].includes(session.role)) redirect("/students");
  const { id } = await params;
  const student = await db.student.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      _count: { select: { occupancies: true, breakReservations: true, payments: true, notifications: true } },
      charges: { select: { occupancyId: true, breakReservationId: true, payments: { select: { id: true }, take: 1 } } },
    },
  });
  if (!student) notFound();
  const canDelete = student._count.occupancies === 0
    && student._count.breakReservations === 0
    && student._count.payments === 0
    && student._count.notifications === 0
    && student.charges.every((charge) => !charge.occupancyId && !charge.breakReservationId && charge.payments.length === 0);

  return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Student register</p><h1>Delete student</h1><p>Review the record before permanent deletion.</p></div></div><DeleteStudentForm studentId={student.id} studentName={student.fullName} canDelete={canDelete} /></div>;
}
