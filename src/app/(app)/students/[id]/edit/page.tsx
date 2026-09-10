import Link from "next/link";
import { BedDouble, CalendarDays, ExternalLink } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { CheckInForm } from "@/components/occupancy-forms";
import { StudentForm } from "@/components/student-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/students");
  const { id } = await params;
  const [student, activeOccupancy, semesters, rooms] = await Promise.all([
    db.student.findFirst({ where: { id, organizationId: session.organizationId }, include: { guardian: true } }),
    db.occupancy.findFirst({
      where: { studentId: id, organizationId: session.organizationId, status: "ACTIVE" },
      include: { room: { include: { roomType: true } }, semester: true },
      orderBy: { checkInAt: "desc" },
    }),
    db.semester.findMany({
      where: { organizationId: session.organizationId, status: "ACTIVE" },
      orderBy: { startDate: "desc" },
    }),
    db.room.findMany({
      where: { organizationId: session.organizationId, status: { notIn: ["MAINTENANCE", "INACTIVE"] } },
      include: {
        roomType: true,
        occupancies: { where: { status: "ACTIVE" }, select: { studentId: true } },
        breakReservations: { where: { status: "RESERVED_FREE" }, select: { studentId: true } },
      },
      orderBy: { number: "asc" },
    }),
  ]);
  if (!student) notFound();

  const roomOptions = rooms.flatMap((room) => {
    const capacity = room.capacityOverride ?? room.roomType.defaultCapacity;
    const heldStudentIds = new Set([
      ...room.occupancies.map((item) => item.studentId),
      ...room.breakReservations.map((item) => item.studentId),
    ]);
    const available = heldStudentIds.size < capacity || heldStudentIds.has(student.id);
    if (!available) return [];
    return [{
      id: room.id,
      label: `Room ${room.number} · ${room.roomType.name} · ${heldStudentIds.size}/${capacity} · KES ${Number(room.roomType.semesterRate).toLocaleString("en-KE")}`,
    }];
  });

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

      <div className="mt-5" id="room-assignment">
        {activeOccupancy ? (
          <section className="panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">Current accommodation</p><h2>Room {activeOccupancy.room.number}</h2></div>
              <BedDouble size={20} />
            </div>
            <dl className="detail-list">
              <div><dt>Accommodation type</dt><dd>{activeOccupancy.room.roomType.name}</dd></div>
              <div><dt>Semester</dt><dd>{activeOccupancy.semester.name}</dd></div>
              <div><dt>Check-in date</dt><dd>{activeOccupancy.checkInAt.toLocaleDateString("en-KE", { timeZone: "UTC" })}</dd></div>
            </dl>
            <div className="form-actions">
              <Link className="primary-button no-underline" href={`/occupancy/${activeOccupancy.id}`}><ExternalLink size={17} /> Manage room assignment</Link>
            </div>
          </section>
        ) : student.status === "SUSPENDED" || student.status === "ARCHIVED" ? (
          <section className="policy-banner"><BedDouble size={21} /><div><strong>Room assignment unavailable</strong><p>Change the student status to Active or Checked out before assigning accommodation.</p></div></section>
        ) : !semesters.length ? (
          <section className="policy-banner"><CalendarDays size={21} /><div><strong>No active semester</strong><p>Create or activate a semester before assigning this student to a room.</p></div></section>
        ) : !roomOptions.length ? (
          <section className="policy-banner"><BedDouble size={21} /><div><strong>No rooms available</strong><p>Add a room or free space in an existing room before assigning this student.</p></div></section>
        ) : (
          <CheckInForm
            cancelHref="/students"
            rooms={roomOptions}
            selectedStudent={{ id: student.id, label: student.fullName }}
            semesters={semesters.map((item) => ({ id: item.id, label: item.name }))}
            students={[]}
          />
        )}
      </div>
    </div>
  );
}

