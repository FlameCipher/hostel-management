import { DashboardView } from "./dashboard-view";
import { formatMoney, roundCurrency } from "@/lib/currency";
import { managementCurrency } from "@/lib/organization-currency";
import { requireStaffFinanceAccess } from "@/lib/staff-route-authorization";
import { db } from "@/lib/db";
import { getEffectiveRoomStatus } from "@/lib/rooms";
import { requestPropertyContext } from "@/lib/property-host";
import { hostelTimeZone } from "@/lib/resident-policy";
import { ownerOperationLinks } from "@/lib/owner-operations";
import { backupEvidenceStatus } from "@/lib/backup-readiness";

export default async function DashboardPage() {
  const currency = await managementCurrency();
  const money = (value: number) => formatMoney(value, currency);
  const session = await requireStaffFinanceAccess();
  const semester = await db.semester.findFirst({ where: { organizationId: session.organizationId, status: "ACTIVE" } });
  const canReviewOperations=session.role==="OWNER" || session.role==="ADMIN";
  // Private archives are platform-wide. Keep their infrastructure status visible
  // only to the nominated hostel owner/admin, not arbitrary tenant landlords.
  const canReviewBackup=canReviewOperations && session.organizationId==="mama-mbugua-hostel";
  const [rooms, students, charges, recentPayments, activeSOS, overdueOutings, lateUnacknowledged, returnReported, portalsEnabled, pendingApplications, pendingReceipts, activeCaretakers, lastBackup] = await Promise.all([
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
    canReviewOperations ? db.student.count({where:{organizationId:session.organizationId,status:"ACTIVE",portalEnabled:true}}) : Promise.resolve(0),
    canReviewOperations ? db.tenantRegistration.count({where:{organizationId:session.organizationId,status:"PENDING"}}) : Promise.resolve(0),
    canReviewOperations ? db.payment.count({where:{organizationId:session.organizationId,reversedAt:null,receiptDeliveryStatus:{in:["PENDING","FAILED","ACTION_REQUIRED"]}}}) : Promise.resolve(0),
    canReviewOperations ? db.user.count({where:{organizationId:session.organizationId,active:true,role:"CARETAKER"}}) : Promise.resolve(0),
    canReviewBackup ? db.operationalRun.findFirst({where:{kind:"BACKUP"},orderBy:{createdAt:"desc"},select:{status:true,createdAt:true,completedAt:true,metadata:true}}) : Promise.resolve(null),
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
    canVerifyRegistrations={canReviewOperations}
    operations={canReviewOperations ? ownerOperationLinks({
      inactivePortals: Math.max(0,students-portalsEnabled),
      pendingApplications,
      pendingReceipts,
      activeCaretakers,
      backupNeedsAttention:canReviewBackup && (!process.env.BACKUP_BLOB_STORE_ID?.trim() || backupEvidenceStatus(lastBackup)!=="PASSING"),
    }) : []}
    recentPayments={recentPayments.map(payment => ({
      id: payment.id,
      student: payment.student.fullName,
      amount: money(Number(payment.amount)),
      date: date(payment.paidAt),
      receipt: payment.receiptNumber,
    }))}
  />;
}
