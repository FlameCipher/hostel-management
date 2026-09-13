import { notFound, redirect } from "next/navigation";
import { DeleteStudentForm } from "@/components/delete-student-form";
import { MergeStudentForm } from "@/components/merge-student-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { matchingStudentIdentifier } from "@/lib/student-identifiers";

export default async function DeleteStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!["OWNER", "ADMIN"].includes(session.role)) redirect("/students");
  const { id } = await params;
  const [student, possibleTargets] = await Promise.all([
    db.student.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        _count: { select: { occupancies: true, breakReservations: true, payments: true, notifications: true } },
        charges: { select: { occupancyId: true, breakReservationId: true, payments: { select: { id: true }, take: 1 } } },
      },
    }),
    db.student.findMany({
      where: { organizationId: session.organizationId, NOT: { id } },
      include: {
        occupancies: { where: { status: "ACTIVE" }, select: { room: { select: { number: true, floor: true } } }, take: 1 },
        _count: { select: { payments: true } },
      },
      orderBy: { fullName: "asc" },
    }),
  ]);
  if (!student) notFound();
  const canDelete = student._count.occupancies === 0
    && student._count.breakReservations === 0
    && student._count.payments === 0
    && student._count.notifications === 0
    && student.charges.every((charge) => !charge.occupancyId && !charge.breakReservationId && charge.payments.length === 0);
  const canMergeFromSource = student._count.occupancies === 0 && student._count.breakReservations === 0;
  const candidates = canMergeFromSource ? possibleTargets
    .filter((candidate) => matchingStudentIdentifier(student, candidate))
    .sort((left, right) => Number(Boolean(right.occupancies[0])) - Number(Boolean(left.occupancies[0]))
      || right._count.payments - left._count.payments)
    .map((candidate) => {
      const occupancy = candidate.occupancies[0];
      const location = occupancy ? `Room ${occupancy.room.number} · ${occupancy.room.floor || "Floor unspecified"}` : "Not allocated";
      return { id: candidate.id, label: `${candidate.fullName} · ${location} · ${candidate._count.payments} receipt${candidate._count.payments === 1 ? "" : "s"}` };
    }) : [];

  return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Student register</p><h1>Resolve student record</h1><p>Delete an unused entry or merge a duplicate while preserving its history.</p></div></div>{candidates.length ? <MergeStudentForm sourceStudentId={student.id} sourceName={student.fullName} candidates={candidates} /> : <DeleteStudentForm studentId={student.id} studentName={student.fullName} canDelete={canDelete} />}</div>;
}
