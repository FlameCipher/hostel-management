import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Banknote } from "lucide-react";
import { CheckInForm } from "@/components/occupancy-forms";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentId?: string }>;
}) {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/occupancy");
  const { paymentId } = await searchParams;

  if (!paymentId) {
    const pendingPayments = await db.payment.findMany({
      where: {
        organizationId: session.organizationId,
        reversedAt: null,
        charge: { type: "SEMESTER_RENT", occupancyId: null, semester: { status: "ACTIVE" } },
      },
      include: { student: true, charge: { include: { roomType: true, semester: true } } },
      orderBy: { paidAt: "asc" },
    });
    const allocations = pendingPayments.filter((payment, index, items) => items.findIndex((item) => item.chargeId === payment.chargeId) === index);

    return (
      <div className="form-page">
        <div className="page-heading-row"><div><p className="eyebrow">Paid student intake</p><h1>Select student to allocate</h1><p>Only students with a valid initial payment appear here.</p></div></div>
        <section className="panel overflow-hidden">
          {allocations.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Student</th><th>Room type</th><th>Semester</th><th>Initial payment</th><th /></tr></thead><tbody>{allocations.map((payment) => <tr key={payment.id}><td><strong>{payment.student.fullName}</strong></td><td>{payment.charge.roomType?.name ?? "Any matching room"}</td><td>{payment.charge.semester?.name ?? "—"}</td><td>KES {Number(payment.amount).toLocaleString("en-KE")}</td><td><Link className="table-action" href={`/occupancy/check-in?paymentId=${payment.id}`}>Allocate <ArrowRight size={14} /></Link></td></tr>)}</tbody></table></div> : <div className="inline-empty"><Banknote size={25} /><strong>No paid student awaiting allocation</strong><p>Register a student and record the initial payment first.</p></div>}
        </section>
      </div>
    );
  }

  const intakePayment = await db.payment.findFirst({
    where: { id: paymentId, organizationId: session.organizationId, reversedAt: null },
    include: { student: true, charge: { include: { semester: true, roomType: true } } },
  });

  if (!intakePayment) redirect("/payments");
  if (intakePayment.charge.occupancyId) redirect(`/payments/${intakePayment.id}/receipt`);
  if (intakePayment.charge.type !== "SEMESTER_RENT" || !intakePayment.charge.semester || intakePayment.charge.semester.status !== "ACTIVE") redirect("/payments");

  const rooms = await db.room.findMany({
    where: {
      organizationId: session.organizationId,
      status: { notIn: ["MAINTENANCE", "INACTIVE"] },
      ...(intakePayment.charge.roomTypeId ? { roomTypeId: intakePayment.charge.roomTypeId } : {}),
    },
    include: {
      roomType: true,
      occupancies: { where: { status: "ACTIVE" } },
      breakReservations: { where: { status: "RESERVED_FREE" } },
    },
    orderBy: { number: "asc" },
  });

  const roomOptions = rooms.flatMap((room) => {
    const capacity = room.capacityOverride ?? room.roomType.defaultCapacity;
    const held = new Set([
      ...room.occupancies.map((item) => item.studentId),
      ...room.breakReservations.map((item) => item.studentId),
    ]);
    if (held.size >= capacity && !held.has(intakePayment.studentId)) return [];
    return [{ id: room.id, number: room.number, floor: room.floor, type: room.roomType.name, occupied: held.size, capacity, rate: Number(room.roomType.semesterRate) }];
  });

  if (!roomOptions.length) {
    return <div className="form-page"><section className="policy-banner"><div><strong>No matching rooms available</strong><p>Add or free a room matching {intakePayment.charge.roomType?.name ?? "the selected accommodation type"}.</p></div></section></div>;
  }

  return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Paid student intake</p><h1>Allocate room</h1><p>The initial payment is recorded. Complete the intake by assigning a specific room number.</p></div></div><CheckInForm paymentId={intakePayment.id} rooms={roomOptions} selectedSemester={{ id: intakePayment.charge.semester.id, label: intakePayment.charge.semester.name }} selectedStudent={{ id: intakePayment.student.id, label: intakePayment.student.fullName }} semesters={[]} students={[]} /></div>;
}
