import { DashboardView } from "./dashboard-view";
import { formatMoney, roundCurrency } from "@/lib/currency";
import { managementCurrency } from "@/lib/organization-currency";
import { requireStaffFinanceAccess } from "@/lib/staff-route-authorization";
import { db } from "@/lib/db";
import { getEffectiveRoomStatus } from "@/lib/rooms";
import { requestPropertyContext } from "@/lib/property-host";
import { hostelTimeZone } from "@/lib/resident-policy";

export default async function DashboardPage() {
  const currency = await managementCurrency();
  const money = (value: number) => formatMoney(value, currency);
  const session = await requireStaffFinanceAccess();
  const semester = await db.semester.findFirst({ where: { organizationId: session.organizationId, status: "ACTIVE" } });
  const [rooms, students, charges, recentPayments, activeSOS, overdueOutings, lateUnacknowledged, returnReported] = await Promise.all([
    db.room.findMany({ where: { organizationId: session.organizationId }, include: { roomType: true, occupancies: { where: { status: "ACTIVE" }, include: { student: true } }, breakReservations: { where: { status: { in: ["RESERVED_FREE", "CHARGED"] }, intent: "RETURNING", clearedAt: null }, include: { student: true } } }, orderBy: { number: "asc" } }),
    db.student.count({ where: { organizationId: session.organizationId, status: "ACTIVE" } }),
    db.charge.findMany({ where: { organizationId: session.organizationId, ...(semester ? { semesterId: semester.id } : {}) }, include: { payments: { where: { reversedAt: null } } } }),
    db.payment.findMany({ where: { organizationId: session.organizationId, reversedAt: null }, include: { student: true, charge: true }, orderBy: { paidAt: "desc" }, take: 3 }),
    db.safetyAlert.count({ where: { organizationId: session.organizationId, status: { in: ["OPEN", "ACKNOWLEDGED"] } } }),
    db.studentOuting.count({where:{organizationId:session.organizationId,status:"OUT",
      expectedReturnAt:{lt:new Date()}}}),
    db.studentOuting.count({where:{organizationId:session.organizationId,status:"OUT",
      lateNotifiedAt:{not:null},lateAcknowledgedAt:null}}),
    db.studentOuting.count({where:{organizationId:session.organizationId,status:"RETURN_REPORTED"}}),
  ]);
  const context = await requestPropertyContext();
  const timeZone = hostelTimeZone(context.property?.timeZone, context.property?.countryCode ?? "");
  const date = (value: Date) => value.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone });
  const roomData = rooms.map((room) => { const capacity = room.capacityOverride ?? room.roomType.defaultCapacity; const heldIds = new Set([...room.occupancies.map((item) => item.studentId), ...room.breakReservations.map((item) => item.studentId)]); return { ...room, capacity, held: heldIds.size, effectiveStatus: getEffectiveRoomStatus(room.status, heldIds.size, capacity) }; });
  const vacant = roomData.filter((room) => room.effectiveStatus === "VACANT").length;
  const occupied = roomData.filter((room) => ["FULL", "PARTIALLY_OCCUPIED"].includes(room.effectiveStatus)).length;
  const expected = charges.reduce((sum, charge) => sum + Number(charge.amount), 0);
  const collected = charges.reduce((sum, charge) => sum + charge.payments.reduce((paid, item) => paid + Number(item.amount), 0), 0);
  const outstanding = Math.max(0, roundCurrency(expected - collected, currency));
  const overdueCharges = charges.filter((charge) => charge.dueDate < new Date() && roundCurrency(Number(charge.amount) - charge.payments.reduce((sum, item) => sum + Number(item.amount), 0), currency) > 0);
  return <DashboardView
    semester={semester?.name ?? "No active semester"}
    date={date(new Date())}
    dateTime={new Date().toISOString()}
    timeZone={timeZone}
    students={students}
    rooms={rooms.length}
    occupied={occupied}
    vacant={vacant}
    collected={money(collected)}
    expected={money(expected)}
    outstanding={money(outstanding)}
    hasCharges={charges.length > 0}
    overdueCharges={overdueCharges.length}
    activeSOS={activeSOS}
    overdueOutings={overdueOutings}
    lateUnacknowledged={lateUnacknowledged}
    returnReported={returnReported}
    canVerifyRegistrations={session.role === "OWNER" || session.role === "ADMIN"}
    recentPayments={recentPayments.map(payment => ({
      id: payment.id,
      student: payment.student.fullName,
      amount: money(Number(payment.amount)),
      date: date(payment.paidAt),
      receipt: payment.receiptNumber,
    }))}
  />;
}
