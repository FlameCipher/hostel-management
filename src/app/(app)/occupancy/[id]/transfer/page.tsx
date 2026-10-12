import { formatMoney } from "@/lib/currency";
import { managementCurrency } from "@/lib/organization-currency";
import { notFound, redirect } from "next/navigation";
import { TransferForm } from "@/components/occupancy-forms";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { compareRooms } from "@/lib/natural-sort";
import { isStandardMonthlyAdjustment } from "@/lib/monthly-rent-reconciliation";

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const currency = await managementCurrency();
  const money = (value: number) => formatMoney(value, currency);
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
        charges: { where: { type: "SEMESTER_RENT" }, include: { adjustments: { select: { reason: true, calculationMethod: true, calculationData: true } } }, orderBy: { createdAt: "asc" } },
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
  const options = rooms.filter((room) => {
    if(room.id===occupancy.roomId)return false;
    const held=new Set([
      ...room.occupancies.map(item=>item.studentId),
      ...room.breakReservations.map(item=>item.studentId),
    ]);
    const capacity=room.capacityOverride??room.roomType.defaultCapacity;
    return held.size<capacity||held.has(occupancy.studentId);
  }).map((room) => ({
    id: room.id,
    label: `Room ${room.number} · ${room.floor || "Floor unspecified"} · ${room.roomType.name} · ${new Set([...room.occupancies.map((item) => item.studentId), ...room.breakReservations.map((item) => item.studentId)]).size}/${room.capacityOverride ?? room.roomType.defaultCapacity} · ${money(Number(room.roomType.semesterRate))}`,
    semesterRate: Number(room.roomType.semesterRate),
    monthlyRate: Number(room.roomType.monthlyRate),
  }));
  const openStay=occupancy.roomStays.find(stay=>stay.endDate===null);
  const transferMinimum=new Date(Math.max(
    occupancy.checkInAt.getTime(),
    openStay?.startDate.getTime()??occupancy.checkInAt.getTime(),
  )+86_400_000).toISOString().slice(0,10);
  const start = occupancy.semester.startDate;
  const end = occupancy.semester.endDate;
  const semesterFullMonths = start.getUTCDate() === 1 &&
    end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();
  const monthlyEligible = semesterFullMonths && occupancy.charges.length === 1 &&
    occupancy.charges[0].adjustments.every((adjustment) => isStandardMonthlyAdjustment(adjustment)) &&
    occupancy.roomStays.length > 0 && occupancy.roomStays.filter((stay) => stay.endDate === null).length === 1;
  const stays = occupancy.roomStays.length ? occupancy.roomStays : [{ roomId: occupancy.roomId, startDate: occupancy.checkInAt, endDate: null, semesterRateSnapshot: occupancy.room.roomType.semesterRate, monthlyRateSnapshot: occupancy.room.roomType.monthlyRate }];
  return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Room transfer</p><h1>Move {occupancy.student.fullName}</h1><p>Current room: {occupancy.room.number}. Review the financial effect before completing the transfer.</p>
  <p><a href={`/occupancy/${encodeURIComponent(occupancy.id)}/transfer-review`}>Inspect recorded room history first</a></p></div></div><TransferForm monthlyEligible={monthlyEligible} minTransferDate={transferMinimum} allowCustom={["OWNER", "ADMIN"].includes(session.role)} currentRent={Number(occupancy.charges[0].amount)} occupancyId={id} rooms={options} semesterEnd={occupancy.semester.endDate.toISOString().slice(0, 10)} semesterStart={occupancy.semester.startDate.toISOString().slice(0, 10)} stays={stays.map((stay) => ({ startDate: stay.startDate.toISOString(), endDate: stay.endDate?.toISOString() ?? null, semesterRate: Number(stay.semesterRateSnapshot), roomId: stay.roomId, monthlyRate: Number(stay.monthlyRateSnapshot) }))} /></div>;
}
