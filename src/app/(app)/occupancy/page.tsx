import { formatMoney } from "@/lib/currency";
import { managementCurrency } from "@/lib/organization-currency";
import Link from "next/link";
import { Archive, CalendarDays, CircleCheck, Eye, RotateCcw, UserPlus, Search } from "lucide-react";
import { BreakDecisionForm, BreakPeriodForm } from "@/components/break-forms";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { confirmBreakReturnAction } from "./actions";

const statusLabel: Record<string, string> = {
  RESERVED_FREE: "Reserved free", CLEARANCE_REQUIRED: "Checkout required", RETURN_CONFIRMED: "Return confirmed",
  VACATED_CLEARED: "Cleared", CHARGED: "Break charged", PENDING: "Pending", RETURN_CANCELLED: "Return cancelled",
};

export default async function OccupancyPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const currency = await managementCurrency();
  const money = (value: number) => formatMoney(value, currency);
  const session = await requireSession();
  const canManage = session.role !== "CARETAKER";
  const search = (await searchParams).q?.trim().slice(0, 80) ?? "";
  const normalizedSearch = search.replace(/^room\s*(?:number\s*)?/i, "").toLocaleLowerCase();
  const [periods, occupancies, reservations, organization] = await Promise.all([
    db.breakPeriod.findMany({ where: { organizationId: session.organizationId, status: { in: ["UPCOMING", "ACTIVE"] } }, orderBy: { startDate: "desc" } }),
    db.occupancy.findMany({ where: { organizationId: session.organizationId, status: "ACTIVE" }, include: { student: true, room: { include: { roomType: true } } }, orderBy: { student: { fullName: "asc" } } }),
    db.breakReservation.findMany({ where: { organizationId: session.organizationId }, include: { student: true, room: true, breakPeriod: true, charge: { include: { payments: { where: { reversedAt: null } } } } }, orderBy: { createdAt: "desc" } }),
    db.organization.findUniqueOrThrow({ where: { id: session.organizationId }, select: { defaultBreakMonths: true } }),
  ]);
  const activeOccupancyByStudent = new Map(occupancies.map((item) => [item.studentId, item.id]));
  // Search only the current hostel's already-scoped active occupancies.
  // Keep the unfiltered occupancies for break decisions and return processing.
  const matchingOccupancies = normalizedSearch
    ? occupancies.filter((item) => {
        const term = normalizedSearch;
        return item.student.fullName.toLocaleLowerCase().includes(term) ||
          item.room.number.toLocaleLowerCase() === term ||
          (item.student.admissionNumber ?? "").toLocaleLowerCase().includes(term);
      })
    : occupancies;

  return <div>
    <div className="page-heading-row"><div><p className="eyebrow">Occupancy management</p><h1>Check-in and check-out</h1><p>Manage active stays, room transfers, clearance and break reservations.</p></div>{canManage ? <Link className="primary-button no-underline" href="/occupancy/check-in"><UserPlus size={17} /> Allocate paid student</Link> : null}</div>
    <section className="panel overflow-hidden"><div className="panel-heading"><div><p className="panel-kicker">Current residents</p><h2>{normalizedSearch ? `${matchingOccupancies.length} matching residents` : `${occupancies.length} active occupanc${occupancies.length === 1 ? "y" : "ies"}`}</h2></div></div>
    <form method="get" className="filter-bar" role="search">
      <label className="filter-search"><Search size={17} aria-hidden="true"/><input name="q" aria-label="Find student or room" placeholder="Student name, admission number or room 54" defaultValue={search} maxLength={80}/></label>
      <button className="secondary-button" type="submit">Find resident</button>
      {normalizedSearch ? <Link className="text-link" href="/occupancy">Show all residents</Link> : null}
    </form>
    {matchingOccupancies.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Student</th><th>Room</th><th>Check-in</th><th>Status</th><th /></tr></thead><tbody>{matchingOccupancies.map((item) => <tr key={item.id}><td><strong>{item.student.fullName}</strong></td><td><strong>Room {item.room.number}</strong><small className="table-subtext">{item.room.roomType.name}{canManage ? ` · ${money(Number(item.room.roomType.monthlyRate))}/month` : ""}</small></td><td>{item.checkInAt.toLocaleDateString("en-KE", { timeZone: "UTC" })}</td><td><span className="status-pill status-full">Active</span></td><td><Link className="table-action" href={`/occupancy/${item.id}`}><Eye size={14} /> View</Link></td></tr>)}</tbody></table></div> : <div className="inline-empty"><UserPlus size={25} /><strong>{normalizedSearch ? "No matching residents" : "No active occupants"}</strong><p>{normalizedSearch ? "Check the student name, admission number or room number, or clear your search." : "Check in a student to allocate a room and generate rent."}</p></div>}</section>
    <section className="policy-banner"><Archive size={22} /><div><strong>Break room policy</strong><p>A returning student reserves the room free only when no belongings remain. Stored belongings create the configured break charge. A student who is not returning must complete normal checkout.</p></div></section>
    {canManage ? <div className="dashboard-grid mt-5"><section className="panel"><div className="panel-heading"><div><p className="panel-kicker">Configuration</p><h2>Create break period</h2></div><CalendarDays size={19} /></div><BreakPeriodForm defaultMonths={organization.defaultBreakMonths} /></section><section className="panel"><div className="panel-heading"><div><p className="panel-kicker">Student intention</p><h2>Record break decision</h2></div><RotateCcw size={19} /></div><BreakDecisionForm allowCustom={["OWNER", "ADMIN"].includes(session.role)} periods={periods.map((item) => ({ id: item.id, label: item.name, months: item.months, storageChargeMode: item.storageChargeMode, storageChargeValue: item.storageChargeValue === null ? null : Number(item.storageChargeValue) }))} occupancies={occupancies.map((item) => ({ id: item.id, label: `${item.student.fullName} · Room ${item.room.number} · ${item.room.floor || "Floor unspecified"}`, monthlyRate: Number(item.room.roomType.monthlyRate) }))} /></section></div> : null}
    <section className="panel mt-5 overflow-hidden"><div className="panel-heading"><div><p className="panel-kicker">Break register</p><h2>{reservations.length} reservation{reservations.length === 1 ? "" : "s"}</h2></div></div>{reservations.length ? <div className="table-scroll"><table className="data-table break-table"><thead><tr><th>Student</th><th>Room</th><th>Break</th><th>Belongings</th><th>Break charge</th><th>Status</th>{canManage ? <th>Action</th> : null}</tr></thead><tbody>{reservations.map((item) => {
      const occupancyId = activeOccupancyByStudent.get(item.studentId);
      const canConfirm = item.status === "RESERVED_FREE" || item.status === "CHARGED";
      const needsCheckout = ["RESERVED_FREE", "CHARGED", "CLEARANCE_REQUIRED"].includes(item.status) && occupancyId;
      return <tr key={item.id}><td><strong>{item.student.fullName}</strong></td><td>Room {item.room.number}</td><td>{item.breakPeriod.name}</td><td>{item.belongingsStored ? "Stored" : "None"}</td><td>{item.charge ? `${money(Number(item.charge.amount))}` : "None"}</td><td><span className={`status-pill ${item.status === "CHARGED" ? "status-due" : item.status === "VACATED_CLEARED" || item.status === "RETURN_CONFIRMED" ? "status-paid" : "status-partial"}`}>{statusLabel[item.status]}</span></td>{canManage ? <td><div className="row-actions">{canConfirm ? <form action={confirmBreakReturnAction}><input name="reservationId" type="hidden" value={item.id} /><button className="table-action" type="submit"><CircleCheck size={14} /> Confirm return</button></form> : null}{needsCheckout ? <Link className="table-action danger-link" href={`/occupancy/${occupancyId}/checkout`}>Complete checkout</Link> : null}{item.charge ? <span className="muted-note">Charge created</span> : null}</div></td> : null}</tr>;
    })}</tbody></table></div> : <div className="inline-empty"><CalendarDays size={25} /><strong>No break decisions recorded</strong><p>Create a break period and record each active student’s intention.</p></div>}</section>
  </div>;
}
