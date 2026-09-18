import { notFound, redirect } from "next/navigation";
import { TransferForm } from "@/components/occupancy-forms";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { compareRooms } from "@/lib/natural-sort";

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/occupancy");
  const { id } = await params;
  const [occupancy, rooms] = await Promise.all([
    db.occupancy.findFirst({
      where: { id, organizationId: session.organizationId, status: "ACTIVE" },
      include: {
        student: true,
        semester: true,
        room: { include: { roomType: true } },
        roomStays: { orderBy: { startDate: "asc" } },
        charges: { where: { type: "SEMESTER_RENT" }, orderBy: { createdAt: "asc" }, take: 1 },
      },
    }),
    db.room.findMany({
      where: { organizationId: session.organizationId, status: { notIn: ["MAINTENANCE", "INACTIVE"] } },
      include: { roomType: true, occupancies: { where: { status: "ACTIVE" } }, breakReservations: { where: { status: { in: ["RESERVED_FREE", "CHARGED"] }, intent: "RETURNING", clearedAt: null } } },
      orderBy: { number: "asc" },
    }),
  ]);
  if (!occupancy || !occupancy.charges[0]) notFound();
  rooms.sort(compareRooms);
  const options = rooms.filter((room) => room.id !== occupancy.roomId).map((room) => ({
    id: room.id,
    label: `Room ${room.number} · ${room.floor || "Floor unspecified"} · ${room.roomType.name} · ${new Set([...room.occupancies.map((item) => item.studentId), ...room.breakReservations.map((item) => item.studentId)]).size}/${room.capacityOverride ?? room.roomType.defaultCapacity} · KES ${Number(room.roomType.semesterRate).toLocaleString("en-KE")}`,
    semesterRate: Number(room.roomType.semesterRate),
  }));
  const stays = occupancy.roomStays.length ? occupancy.roomStays : [{ startDate: occupancy.checkInAt, endDate: null, semesterRateSnapshot: occupancy.room.roomType.semesterRate }];
  return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Room transfer</p><h1>Move {occupancy.student.fullName}</h1><p>Current room: {occupancy.room.number}. Review the financial effect before completing the transfer.</p></div></div><TransferForm allowCustom={["OWNER", "ADMIN"].includes(session.role)} currentRent={Number(occupancy.charges[0].amount)} occupancyId={id} rooms={options} semesterEnd={occupancy.semester.endDate.toISOString().slice(0, 10)} semesterStart={occupancy.semester.startDate.toISOString().slice(0, 10)} stays={stays.map((stay) => ({ startDate: stay.startDate.toISOString(), endDate: stay.endDate?.toISOString() ?? null, semesterRate: Number(stay.semesterRateSnapshot) }))} /></div>;
}
