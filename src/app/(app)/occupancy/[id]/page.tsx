import { formatMoney } from "@/lib/currency";
import { calculateMonthlyTransferRent } from "@/lib/monthly-transfer-rent";
import { managementCurrency } from "@/lib/organization-currency";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightLeft, BedDouble, LogOut, Phone, ReceiptText, UserRound } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";


export default async function OccupancyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currency = await managementCurrency();
  const money = (value: number) => formatMoney(value, currency);
  const session = await requireSession();
  const { id } = await params;
  const occupancy = await db.occupancy.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      student: { include: { guardian: true } },
      room: { include: { roomType: true } },
      semester: true,
      roomStays: { include: { room: true, roomType: true }, orderBy: { startDate: "asc" } },
      charges: { include: { payments: { where: { reversedAt: null } }, adjustments: { include: { createdBy: true }, orderBy: { createdAt: "desc" } } } },
    },
  });
  if (!occupancy) notFound();
  const canManage = session.role !== "CARETAKER" && occupancy.status === "ACTIVE";
  const canReviewRent = ["OWNER","ADMIN","MANAGER"].includes(session.role);
  const rentCharges = occupancy.charges.filter((charge) => charge.type === "SEMESTER_RENT");
  const start = occupancy.semester.startDate;
  const end = occupancy.semester.endDate;
  const fullCalendarMonths = start.getUTCDate() === 1 &&
    end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth()+1, 0)).getUTCDate();
  let rentReview: ReturnType<typeof calculateMonthlyTransferRent> | null = null;
  let reviewWarning = "";
  if (canReviewRent && occupancy.roomStays.length && fullCalendarMonths && rentCharges.length === 1) {
    try {
      rentReview = calculateMonthlyTransferRent({
        currency,
        firstMonth: start.toISOString().slice(0,7),
        lastMonth: end.toISOString().slice(0,7),
        stays: occupancy.roomStays.map((stay) => ({
          roomId: stay.roomId, startDate: stay.startDate, monthlyRate: Number(stay.monthlyRateSnapshot),
        })),
      });
    } catch { reviewWarning = "Monthly calculation needs manual review of the room-stay history."; }
  } else if (canReviewRent) {
    reviewWarning = "Automatic comparison unavailable: confirm full calendar-month dates, a single rent charge, and complete room history.";
  }
  const recordedRent = rentCharges.reduce((sum, charge) => sum + Number(charge.amount),0);
  const rentDifference = rentReview ? rentReview.total-recordedRent : null;

  return <div><div className="page-heading-row"><div><p className="eyebrow">Occupancy record</p><h1>{occupancy.student.fullName}</h1><p>Room {occupancy.room.number} · {occupancy.semester.name}</p></div>{canManage ? <div className="heading-actions"><Link className="secondary-button no-underline" href={`/occupancy/${id}/transfer`}><ArrowRightLeft size={17} /> Transfer</Link><Link className="primary-button no-underline" href={`/occupancy/${id}/checkout`}><LogOut size={17} /> Check out</Link></div> : null}</div>{canReviewRent ? <section className="panel mt-5" aria-label="Read-only monthly rent review">
  <div className="panel-heading"><div><p className="panel-kicker">Financial integrity</p><h2>Monthly rent review</h2></div></div>
  <p className="muted-note">Read-only comparison of saved room-rate snapshots against the existing semester rent charge. Payments and records are not changed.</p>
  {rentReview ? <><div className="table-scroll"><table className="data-table"><thead><tr><th>Month</th><th>Room ID</th><th>Monthly rent</th></tr></thead><tbody>{rentReview.lines.map((line)=><tr key={line.month}><td>{line.month}</td><td>{occupancy.roomStays.find((stay)=>stay.roomId===line.roomId)?.room.number ?? "Historical room"}</td><td>{money(line.rate)}</td></tr>)}</tbody></table></div>
  <p><strong>Expected rent: {money(rentReview.total)}</strong> · Recorded rent: {money(recordedRent)}</p>
  <p>{rentDifference === 0 ? "Recorded rent matches the month-based comparison." : `Difference requiring review: ${money(Math.abs(rentDifference ?? 0))} ${rentDifference !== null && rentDifference > 0 ? "additional expected rent" : "potential credit"}.`}</p></> : <p role="status">{reviewWarning}</p>}
  <p className="muted-note">Verify the applicable accommodation agreement, rate changes, discounts, payment allocations and partial months before approving any adjustment.</p>
</section> : null}<section className="detail-grid"><article className="panel"><div className="panel-heading"><div><p className="panel-kicker">Student</p><h2>Contact and guardian</h2></div><UserRound size={19} /></div><dl className="detail-list"><div><dt>Phone</dt><dd><a href={`tel:${occupancy.student.phone}`}><Phone size={12} /> {occupancy.student.phone}</a></dd></div><div><dt>Admission number</dt><dd>{occupancy.student.admissionNumber || "Not provided"}</dd></div><div><dt>Guardian</dt><dd>{occupancy.student.guardian?.name || "Not provided"}</dd></div><div><dt>Guardian phone</dt><dd>{occupancy.student.guardian?.phone || "Not provided"}</dd></div></dl></article><article className="panel"><div className="panel-heading"><div><p className="panel-kicker">Accommodation</p><h2>Room and stay</h2></div><BedDouble size={19} /></div><dl className="detail-list"><div><dt>Current room</dt><dd>Room {occupancy.room.number}</dd></div><div><dt>Type</dt><dd>{occupancy.room.roomType.name}</dd></div><div><dt>Check-in</dt><dd>{occupancy.checkInAt.toLocaleDateString("en-KE", { timeZone: "UTC" })}</dd></div><div><dt>Status</dt><dd>{occupancy.status}</dd></div></dl></article></section><section className="panel mt-5 overflow-hidden"><div className="panel-heading"><div><p className="panel-kicker">Financial position</p><h2>Charges, adjustments and balances</h2></div><ReceiptText size={19} /></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Description</th><th>Charge</th><th>Paid</th><th>Balance / credit</th><th>Status</th></tr></thead><tbody>{occupancy.charges.map((charge) => { const paid = charge.payments.reduce((sum, item) => sum + Number(item.amount), 0); const net = Number(charge.amount) - paid; const balance = Math.max(0, net); const credit = Math.max(0, -net); return <tr key={charge.id}><td><strong>{charge.description}</strong>{charge.adjustments.length ? <small className="table-subtext">{charge.adjustments.length} audited adjustment{charge.adjustments.length === 1 ? "" : "s"}</small> : null}</td><td>{money(Number(charge.amount))}</td><td>{money(paid)}</td><td><strong>{credit ? `Credit ${money(credit)}` : money(balance)}</strong></td><td>{credit ? "CREDIT DUE" : charge.status}</td></tr>; })}</tbody></table></div></section>{occupancy.roomStays.length ? <section className="panel mt-5 overflow-hidden"><div className="panel-heading"><div><p className="panel-kicker">Movement history</p><h2>Room-stay segments</h2></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Room</th><th>Accommodation</th><th>From</th><th>Until</th><th>Rate snapshot</th></tr></thead><tbody>{occupancy.roomStays.map((stay) => <tr key={stay.id}><td><strong>Room {stay.room.number}</strong></td><td>{stay.roomType.name}</td><td>{stay.startDate.toLocaleDateString("en-KE", { timeZone: "UTC" })}</td><td>{stay.endDate ? stay.endDate.toLocaleDateString("en-KE", { timeZone: "UTC" }) : "Current"}</td><td>{money(Number(stay.semesterRateSnapshot))} / semester</td></tr>)}</tbody></table></div></section> : null}{occupancy.charges.some((charge) => charge.adjustments.length) ? <section className="panel mt-5 overflow-hidden"><div className="panel-heading"><div><p className="panel-kicker">Audit trail</p><h2>Rent adjustments</h2></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Reason</th><th>Method</th><th>Previous</th><th>Adjustment</th><th>New total</th><th>Approved by</th></tr></thead><tbody>{occupancy.charges.flatMap((charge) => charge.adjustments).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((adjustment) => <tr key={adjustment.id}><td>{adjustment.effectiveDate.toLocaleDateString("en-KE", { timeZone: "UTC" })}</td><td><strong>{adjustment.reason.replaceAll("_", " ")}</strong><small className="table-subtext">{adjustment.explanation}</small></td><td>{adjustment.calculationMethod.replaceAll("_", " ")}</td><td>{money(Number(adjustment.previousAmount))}</td><td>{money(Number(adjustment.adjustmentAmount))}</td><td>{money(Number(adjustment.newAmount))}</td><td>{adjustment.createdBy?.name ?? "System"}</td></tr>)}</tbody></table></div></section> : null}</div>;
}
