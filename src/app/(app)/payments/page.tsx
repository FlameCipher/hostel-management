import { formatMoney, roundCurrency } from "@/lib/currency";
import { managementCurrency } from "@/lib/organization-currency";
import Link from "next/link";
import { AlertCircle, Banknote, FilePlus2, ListChecks, Mail, Plus, ReceiptText, RotateCcw, Search, ShieldCheck, WalletCards } from "lucide-react";
import { ReceiptShareActions } from "@/components/receipt-share-actions";
import { emailPendingReceiptAction } from "./[id]/receipt/email-action";
import { receiptDeliveryQueueState } from "@/lib/receipt-delivery-queue";
import { currentRentAccountDisplay } from "@/lib/current-rent-account-display";
import { requireStaffFinanceAccess } from "@/lib/staff-route-authorization";
import { db } from "@/lib/db";

const chargeType: Record<string, string> = { SEMESTER_RENT: "Semester rent", BREAK_ACCOMMODATION: "Break accommodation", DAMAGE: "Damage", OTHER: "Other" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string; month?: string; delivery?: string }> }) {
  const currency = await managementCurrency();
  const money = (value: number) => formatMoney(value, currency);
  const session = await requireStaffFinanceAccess();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const outstandingOnly = params.view === "outstanding";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? "") ? params.month! : "";
  const monthStart = month ? new Date(`${month}-01T00:00:00.000Z`) : null;
  const monthEnd = monthStart ? new Date(Date.UTC(monthStart.getUTCFullYear(),monthStart.getUTCMonth()+1,1)) : null;
  const canManage = session.role !== "CARETAKER";
  const canReverse = session.role === "OWNER" || session.role === "ADMIN";
  const expandedDelivery = params.delivery === "all";
  // Read only outstanding receipt delivery work. Never queue reversed or sent receipts.
  const deliveryWhere = {
    organizationId: session.organizationId,
    reversedAt: null,
    receiptDeliveryStatus: {in: ["PENDING", "FAILED", "ACTION_REQUIRED"] as const},
  };
  const [charges, payments, deliveryQueue, deliveryTotal, deliveryNeedsEmail] = await Promise.all([
    db.charge.findMany({ where: { organizationId: session.organizationId }, include: { student: true, semester: true, occupancy: {include: {room: {include: {roomType: true}}}}, payments: { where: { reversedAt: null } } }, orderBy: { dueDate: "asc" } }),
    db.payment.findMany({ where: { organizationId: session.organizationId, ...(query ? { OR: [{ reference: { contains: query, mode: "insensitive" } }, { receiptNumber: { contains: query, mode: "insensitive" } }, { student: { fullName: { contains: query, mode: "insensitive" } } }] } : {}) }, include: { student: true, charge: { include: { semester: true } }, mpesaTransaction: true }, orderBy: { paidAt: "desc" }, take: query ? 100 : 20 }),
    canManage ? db.payment.findMany({
      where: {...deliveryWhere, receiptDeliveryStatus: {in: ["PENDING", "FAILED", "ACTION_REQUIRED"]}},
      include: {
        student: {select: {id: true, fullName: true, email: true, phone: true}},
        charge: {select: {type:true,description:true,roomTypeId:true,semester:{select:{name:true}},occupancy:{include:{room:{include:{roomType:true}}}}}},
      },
      orderBy: {createdAt: "desc"},
      take: expandedDelivery ? 100 : 8,
    }) : Promise.resolve([]),
    canManage ? db.payment.count({
      where: {...deliveryWhere, receiptDeliveryStatus: {in: ["PENDING", "FAILED", "ACTION_REQUIRED"]}},
    }) : Promise.resolve(0),
    canManage ? db.payment.count({
      where: {...deliveryWhere, OR: [
        {student: {email: null}},
        {student: {email: ""}},
      ]},
    }) : Promise.resolve(0),
  ]);
  const rows = charges.map((item) => {
    const paid = item.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const net = roundCurrency(Number(item.amount) - paid, currency);
    const display = currentRentAccountDisplay({
      chargeType: item.type, description: item.description,
      semesterName: item.semester?.name, chargeRoomTypeId: item.roomTypeId,
      occupancy: item.occupancy?.room ? {
        status: item.occupancy.status,
        room: {number:item.occupancy.room.number,roomType:{
          id:item.occupancy.room.roomType.id,name:item.occupancy.room.roomType.name,
        }},
      } : null,
    });
    return { ...item, amountNumber: Number(item.amount), paid,
      balance: Math.max(0, net), credit: Math.max(0, -net),
      currentAccountLabel: display.label,
      roomRateNeedsReview: display.roomTypeMismatch,
    };
  });
  const visibleRows = rows.filter((item) => (!outstandingOnly || item.balance > 0) && (!monthStart || (item.dueDate >= monthStart && item.dueDate < monthEnd!)));
  const expected = rows.reduce((sum, item) => sum + item.amountNumber, 0);
  const collected = rows.reduce((sum, item) => sum + item.paid, 0);
  const outstanding = rows.reduce((sum, item) => sum + item.balance, 0);
  const credits = rows.reduce((sum, item) => sum + item.credit, 0);

  return <div><div className="page-heading-row"><div><p className="eyebrow">Rent collection</p><h1>Payments</h1><p>Manage rent charges, partial payments, balances and printable receipts.</p></div>{canManage ? <div className="heading-actions">{canReverse?<Link className="secondary-button no-underline" href="/payments/audit"><ShieldCheck size={17}/> Financial integrity</Link>:null}<Link className="secondary-button no-underline" href="/payments/reconciliation"><ListChecks size={17} /> Reconcile M-Pesa</Link><Link className="secondary-button no-underline" href="/payments/new?mode=charge"><FilePlus2 size={17} /> Add charge</Link><Link className="primary-button no-underline" href="/payments/new"><Plus size={17} /> Record payment</Link></div> : null}</div>
    <section className="room-summary-grid payments-summary"><article className="compact-stat"><span className="metric-icon metric-blue"><Banknote size={22} /></span><div><p>Total charges</p><strong>{money(expected)}</strong></div></article><article className="compact-stat"><span className="metric-icon metric-green"><WalletCards size={22} /></span><div><p>Collected</p><strong>{money(collected)}</strong></div></article><article className="compact-stat"><span className="metric-icon metric-violet"><ReceiptText size={22} /></span><div><p>Outstanding</p><strong>{money(outstanding)}</strong></div></article><article className="compact-stat"><span className="metric-icon metric-red"><AlertCircle size={22} /></span><div><p>Credits</p><strong>{money(credits)}</strong><small>Paid above adjusted charges</small></div></article></section>
    {canManage ? <section className="panel mt-5 overflow-hidden" aria-label="Receipt delivery queue">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Receipt communications</p>
          <h2>Receipts awaiting delivery · {deliveryTotal}</h2>
          <p className="muted-note">Of the {deliveryTotal} receipts needing follow-up, <strong>{deliveryNeedsEmail} need a student email address</strong> and {deliveryTotal - deliveryNeedsEmail} have an email on file. Confirm each address before sending. WhatsApp drafts are not proof of delivery; reversed receipts are excluded.</p>
        </div>
        <Link className="secondary-button no-underline" href={expandedDelivery ? "/payments" : "/payments?delivery=all"}>
          {expandedDelivery ? "Show fewer" : "Review all receipts"}
        </Link>
      </div>
      {deliveryQueue.length ? <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Receipt</th><th>Resident</th><th>Room / rent account</th><th>Amount</th><th>Delivery status</th><th>Next action</th></tr></thead>
        <tbody>{deliveryQueue.map((payment) => {
          const currentAccount = currentRentAccountDisplay({
            chargeType: payment.charge.type,
            description: payment.charge.description,
            semesterName: payment.charge.semester?.name,
            chargeRoomTypeId: payment.charge.roomTypeId,
            occupancy: payment.charge.occupancy?.room ? {
              status: payment.charge.occupancy.status,
              room: {number: payment.charge.occupancy.room.number,
                roomType: {id: payment.charge.occupancy.room.roomType.id,
                  name: payment.charge.occupancy.room.roomType.name}},
            } : null,
          });
          const workflow = receiptDeliveryQueueState({
            receiptDeliveryStatus: payment.receiptDeliveryStatus,
            receiptDeliveryChannel: payment.receiptDeliveryChannel === "EMAIL" ? "EMAIL" : payment.receiptDeliveryChannel === "WHATSAPP" ? "WHATSAPP" : null,
            receiptDeliveryError: payment.receiptDeliveryError,
            updatedAt: payment.updatedAt,
            reversedAt: payment.reversedAt,
            hasEmail: Boolean(payment.student.email?.trim()),
            hasPhone: Boolean(payment.student.phone?.trim()),
          });
          return <tr key={payment.id}>
            <td><Link className="table-action" href={`/payments/${payment.id}/receipt`}>{payment.receiptNumber}</Link></td>
            <td><strong>{payment.student.fullName}</strong></td>
            <td>{payment.charge.occupancy?.room.number ? `Room ${payment.charge.occupancy.room.number}` : "Pending allocation"}<small className="table-subtext">{currentAccount.label}</small></td>
            <td>{money(Number(payment.amount))}</td>
            <td><span className={`status-pill ${payment.receiptDeliveryStatus === "FAILED" ? "status-maintenance" : "status-partial"}`}>{workflow.label}</span></td>
            <td><div className="row-actions">
              {!payment.student.email?.trim() ? <Link className="table-action" href={`/students/${payment.student.id}/edit`}>Add student email</Link> : null}
              {workflow.emailAvailable ? <form action={emailPendingReceiptAction.bind(null,payment.id)}>
                <button className="table-action" type="submit"><Mail size={14}/> Email PDF</button>
              </form> : null}
              {workflow.whatsappAvailable ? <ReceiptShareActions paymentId={payment.id}/> : null}
              {!workflow.emailAvailable && !workflow.whatsappAvailable ? <Link className="table-action" href={`/students/${payment.student.id}/edit`}>Update contact</Link> : null}
            </div></td>
          </tr>;
        })}</tbody>
      </table></div> : <div className="inline-empty"><ReceiptText size={25}/><strong>All active receipts have been handled</strong><p>There are no undelivered receipts requiring action.</p></div>}
      {expandedDelivery && deliveryTotal>100 ? <p className="muted-note">Showing the latest 100 of {deliveryTotal} receipts needing action.</p> : null}
    </section> : null}
    <section className="panel mt-5 overflow-hidden"><div className="panel-heading"><div><p className="panel-kicker">Receivables</p><h2>{outstandingOnly ? "Outstanding charges" : "Student balances across all semesters"}{month ? ` · Due in ${month}` : ""}</h2>{month ? <p className="muted-note">Filtered by charge due date, not by accommodation month. Semester charges may cover several months.</p> : null}</div><div><Link className="secondary-button no-underline" href={outstandingOnly ? (month ? `/payments?month=${month}` : "/payments") : (month ? `/payments?view=outstanding&month=${month}` : "/payments?view=outstanding")}>{outstandingOnly ? "Show all charges" : "Show outstanding only"}</Link></div></div>{visibleRows.length ? <div className="table-scroll"><table className="data-table payments-table"><thead><tr><th>Student</th><th>Charge</th><th>Total</th><th>Paid</th><th>Balance / credit</th><th>Due date</th><th>Status</th>{canManage ? <th>Action</th> : null}</tr></thead><tbody>{visibleRows.map((item) => { const isOverdue = item.balance > 0 && item.dueDate < new Date(); return <tr key={item.id}><td><strong>{item.student.fullName}</strong></td><td>{chargeType[item.type]}<small className="table-subtext">{item.semester?.name ? `${item.semester.name} · ` : ""}{item.currentAccountLabel}</small>{canReverse && item.roomRateNeedsReview ? <small className="table-subtext">Room type differs from charged accommodation · <Link href="/payments/audit">Review agreement</Link></small> : null}</td><td>{money(item.amountNumber)}</td><td>{money(item.paid)}</td><td><strong>{item.credit > 0 ? `Credit ${money(item.credit)}` : money(item.balance)}</strong></td><td>{item.balance > 0 ? item.dueDate.toLocaleDateString("en-KE", { timeZone: "UTC" }) : "—"}</td><td><span className={`status-pill ${item.credit > 0 ? "status-partial" : item.balance === 0 ? "status-full" : isOverdue ? "status-maintenance" : "status-partial"}`}>{item.credit > 0 ? "Credit due" : item.balance === 0 ? "Fully paid" : isOverdue ? "Overdue" : item.paid ? "Part paid" : "Unpaid"}</span></td>{canManage ? <td>{item.balance > 0 ? <Link className="table-action" href={`/payments/new?chargeId=${item.id}`}>Record payment</Link> : null}</td> : null}</tr>; })}</tbody></table></div> : <div className="inline-empty"><ReceiptText size={25} /><strong>No charges yet</strong><p>Create a semester rent charge before recording a payment.</p></div>}</section>
    <section className="panel mt-5 overflow-hidden"><div className="panel-heading"><div><p className="panel-kicker">Receipt history</p><h2>{query ? `${payments.length} matching payment${payments.length === 1 ? "" : "s"}` : "Recent payments"}</h2></div></div><form className="filter-bar student-filter-bar" method="get"><label className="filter-search"><Search size={17} /><input aria-label="Search payments by student, reference or receipt number" defaultValue={query} name="q" placeholder="Search student, payment reference or receipt" /></label><button className="secondary-button" type="submit">Search payments</button>{query ? <Link className="text-link" href="/payments">Clear</Link> : null}</form>{payments.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Receipt</th><th>Student</th><th>Semester</th><th>Amount</th><th>Method</th><th>Reference</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{payments.map((payment) => <tr className={payment.reversedAt ? "reversed-row" : ""} key={payment.id}><td><strong>{payment.receiptNumber}</strong></td><td>{payment.student.fullName}</td><td>{payment.charge.semester?.name ?? "Not semester-specific"}</td><td>{money(Number(payment.amount))}</td><td>{payment.method.replaceAll("_", " ")}</td><td>{payment.reference || "—"}</td><td>{payment.paidAt.toLocaleDateString("en-KE", { timeZone: "UTC" })}</td><td>{payment.reversedAt ? <span className="status-pill status-maintenance">Reversed</span> : payment.method === "MPESA" ? <span className={`status-pill ${payment.mpesaTransaction?.status === "MATCHED" ? "status-full" : "status-partial"}`}>{payment.mpesaTransaction?.status === "MATCHED" ? "Reconciled" : "Unreconciled"}</span> : <span className="status-pill status-full">Active</span>}</td><td><div className="row-actions"><Link className="table-action" href={`/payments/${payment.id}/receipt`}><ReceiptText size={14} /> Receipt</Link>{canReverse && !payment.reversedAt ? <Link className="danger-link" href={`/payments/${payment.id}/reverse`}><RotateCcw size={14} /> Reverse</Link> : null}</div></td></tr>)}</tbody></table></div> : <div className="inline-empty"><WalletCards size={25} /><strong>{query ? "No matching payments" : "No payments recorded"}</strong>{query ? <p>Try a student name, receipt number or payment reference.</p> : null}</div>}</section>
  </div>;
}
