import { redirect } from "next/navigation";
import { CheckInForm } from "@/components/occupancy-forms";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function CheckInPage() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/occupancy");
  const [students, semesters, rooms] = await Promise.all([
    db.student.findMany({ where: { organizationId: session.organizationId, status: { in: ["ACTIVE", "CHECKED_OUT"] }, occupancies: { none: { status: "ACTIVE" } } }, orderBy: { fullName: "asc" } }),
    db.semester.findMany({ where: { organizationId: session.organizationId, status: "ACTIVE" }, orderBy: { startDate: "desc" } }),
    db.room.findMany({ where: { organizationId: session.organizationId, status: { notIn: ["MAINTENANCE", "INACTIVE"] } }, include: { roomType: true, occupancies: { where: { status: "ACTIVE" } }, breakReservations: { where: { status: "RESERVED_FREE" } } }, orderBy: { number: "asc" } }),
  ]);
  const roomOptions = rooms.map((room) => { const capacity = room.capacityOverride ?? room.roomType.defaultCapacity; const held = new Set([...room.occupancies.map((item) => item.studentId), ...room.breakReservations.map((item) => item.studentId)]).size; return { id: room.id, label: `Room ${room.number} · ${room.roomType.name} · ${held}/${capacity} · KES ${Number(room.roomType.semesterRate).toLocaleString("en-KE")}` }; }).filter((_, index) => { const room = rooms[index]; const capacity = room.capacityOverride ?? room.roomType.defaultCapacity; return new Set([...room.occupancies.map((item) => item.studentId), ...room.breakReservations.map((item) => item.studentId)]).size < capacity; });
  return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Occupancy</p><h1>Check in student</h1><p>Allocate an available room and generate the active semester’s rent.</p></div></div>{semesters.length ? <CheckInForm students={students.map((item) => ({ id: item.id, label: item.fullName }))} semesters={semesters.map((item) => ({ id: item.id, label: item.name }))} rooms={roomOptions} /> : <section className="policy-banner"><div><strong>No active semester</strong><p>Activate a semester before checking in students.</p></div></section>}</div>;
}
