import { ResidentAlertPanel } from "@/components/resident-alert-panel";
import { formatMoney, roundCurrency } from "@/lib/currency";
import { managementCurrency } from "@/lib/organization-currency";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Banknote, BedDouble, CalendarDays, DoorOpen, Users, MessageCircle, Smartphone, CircleAlert } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getEffectiveRoomStatus } from "@/lib/rooms";
import { requestPropertyContext } from "@/lib/property-host";
import { hostelTimeZone } from "@/lib/resident-policy";
import styles from "./dashboard.module.css";

export default async function DashboardPage() {
  const currency = await managementCurrency();
  const money = (value: number) => formatMoney(value, currency);
  const session = await requireSession();
  const semester = await db.semester.findFirst({ where: { organizationId: session.organizationId, status: "ACTIVE" } });
  const [rooms, students, charges, recentPayments] = await Promise.all([
    db.room.findMany({ where: { organizationId: session.organizationId }, include: { roomType: true, occupancies: { where: { status: "ACTIVE" }, include: { student: true } }, breakReservations: { where: { status: { in: ["RESERVED_FREE", "CHARGED"] }, intent: "RETURNING", clearedAt: null }, include: { student: true } } }, orderBy: { number: "asc" } }),
    db.student.count({ where: { organizationId: session.organizationId, status: "ACTIVE" } }),
    db.charge.findMany({ where: { organizationId: session.organizationId, ...(semester ? { semesterId: semester.id } : {}) }, include: { payments: { where: { reversedAt: null } } } }),
    db.payment.findMany({ where: { organizationId: session.organizationId, reversedAt: null }, include: { student: true, charge: true }, orderBy: { paidAt: "desc" }, take: 6 }),
  ]);
  const context = await requestPropertyContext();
  const timeZone = hostelTimeZone(context.property?.timeZone, context.property?.countryCode ?? "");
  const date = (value: Date) => value.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone });
  const roomData = rooms.map((room) => { const capacity = room.capacityOverride ?? room.roomType.defaultCapacity; const heldIds = new Set([...room.occupancies.map((item) => item.studentId), ...room.breakReservations.map((item) => item.studentId)]); return { ...room, capacity, held: heldIds.size, effectiveStatus: getEffectiveRoomStatus(room.status, heldIds.size, capacity) }; });
  const vacant = roomData.filter((room) => room.effectiveStatus === "VACANT").length;
  const occupied = roomData.filter((room) => ["FULL", "PARTIALLY_OCCUPIED"].includes(room.effectiveStatus)).length;
  const maintenance = roomData.filter((room) => room.effectiveStatus === "MAINTENANCE").length;
  const expected = charges.reduce((sum, charge) => sum + Number(charge.amount), 0);
  const collected = charges.reduce((sum, charge) => sum + charge.payments.reduce((paid, item) => paid + Number(item.amount), 0), 0);
  const outstanding = Math.max(0, roundCurrency(expected - collected, currency));
  const overdueCharges = charges.filter((charge) => charge.dueDate < new Date() && roundCurrency(Number(charge.amount) - charge.payments.reduce((sum, item) => sum + Number(item.amount), 0), currency) > 0);
  const fullyPaid = charges.filter((charge) => roundCurrency(Number(charge.amount) - charge.payments.reduce((sum, item) => sum + Number(item.amount), 0), currency) <= 0).length;
  const collectionPercent = expected ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
  const inactive = roomData.filter(room => room.effectiveStatus === "INACTIVE").length;
  const occupancyPercent = rooms.length ? Math.round(occupied / rooms.length * 100) : 0;
  const stats = [
    { label: "Total rooms", value: rooms.length, hint: "Across your property", href: "/rooms", icon: BedDouble, tone: "" },
    { label: "Occupied rooms", value: occupied, hint: "Full or part occupied", href: "/rooms?status=OCCUPIED", icon: Users, tone: styles.green },
    { label: "Vacant rooms", value: vacant, hint: "Available to allocate", href: "/rooms?status=VACANT", icon: DoorOpen, tone: styles.blue },
    { label: "Active students", value: students, hint: "Current residents", href: "/students?status=ACTIVE", icon: Users, tone: styles.purple },
  ];
  const roomStatuses = [
    { label: "Occupied", value: occupied, status: "OCCUPIED", tone: styles.occupied },
    { label: "Vacant", value: vacant, status: "VACANT", tone: styles.vacant },
    { label: "Maintenance", value: maintenance, status: "MAINTENANCE", tone: styles.maintenance },
    { label: "Inactive", value: inactive, status: "INACTIVE", tone: styles.inactive },
  ];
  return <div className={styles.dashboard}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>PROPERTY OVERVIEW</p><h1>Dashboard</h1><div className={styles.context}><span className={styles.term}><CalendarDays size={13} aria-hidden="true"/>{semester?.name ?? "No active semester"}</span><span className={styles.divider} aria-hidden="true">/</span><time dateTime={new Date().toISOString()} title={timeZone}>{date(new Date())}</time></div></div><div className={styles.actions}><Link className={`${styles.button} ${styles.primary}`} href="/payments/new"><Banknote size={16} aria-hidden="true"/>Record payment</Link><Link className={styles.button} href="/rooms">View rooms<ArrowUpRight size={15} aria-hidden="true"/></Link></div></header>
    <section className={styles.metrics} aria-label="Property overview">{stats.map(({ label, value, hint, href, icon: Icon, tone }) => <Link href={href} key={label} className={styles.metric} aria-label={`${label}: ${value}`}><span className={styles.metricLabel}>{label}</span><span className={`${styles.metricIcon} ${tone}`}><Icon aria-hidden="true" size={16}/></span><strong className={styles.metricValue}>{value}</strong><ArrowUpRight aria-hidden="true" size={16} className={styles.metricArrow}/><span className={styles.metricHint}>{hint}</span></Link>)}</section>
    <ResidentAlertPanel/>
    <div className={styles.overview}>
      <section className={styles.finance} aria-label="Rent overview"><header className={styles.sectionHeader}><h2>Rent overview</h2><span>{currency}</span></header><div className={styles.financeAmount}><span>Rent collected</span><strong>{money(collected)}</strong></div><div className={styles.financeSub}><div><span>Expected rent</span><strong>{money(expected)}</strong></div><div><span>Outstanding balance</span><strong>{money(outstanding)}</strong></div></div>{expected > 0 ? <div className={styles.collection}><div><span>Collection progress</span><strong>{collectionPercent}%</strong></div><div className={styles.progress} role="progressbar" aria-label="Rent collection" aria-valuenow={collectionPercent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${collectionPercent}%` }}/></div></div> : <p className={styles.emptyFinance}>No rent charges recorded {semester ? "for this semester" : "yet"}.</p>}<footer className={styles.financeFooter}><Link href="/reports">{overdueCharges.length > 0 && <CircleAlert aria-hidden="true" size={14}/>} {overdueCharges.length} overdue charges<ArrowUpRight aria-hidden="true" size={14}/></Link><span>{fullyPaid} charges fully paid</span></footer></section>
      <section className={styles.card} aria-label="Room occupancy"><header className={styles.sectionHeader}><h2>Room occupancy</h2><Link href="/rooms">View rooms<ArrowUpRight size={14} aria-hidden="true"/></Link></header><div className={styles.occupancyFigure}><strong>{occupancyPercent}%</strong><span>{occupied} of {rooms.length} rooms occupied</span></div><div className={styles.roomBar} aria-hidden="true">{roomStatuses.filter(item => item.value > 0).map(item => <span key={item.label} className={item.tone} style={{ flex: item.value }}/>)}</div><div className={styles.legend}>{roomStatuses.map(item => <Link key={item.label} href={`/rooms?status=${item.status}`}><span className={item.tone} aria-hidden="true"/>{item.label}<strong>{item.value}</strong></Link>)}</div><p className={styles.occupancyNote}>Room status includes active residents and held places.</p></section>
    </div>
    <section className={`${styles.card} ${styles.payments}`} aria-label="Recent payments"><header className={styles.sectionHeader}><h2>Recent payments</h2><Link href="/payments">View all<ArrowRight aria-hidden="true" size={14}/></Link></header>{recentPayments.length ? <><div className={styles.mobilePayments}>{recentPayments.map(payment => <article className={styles.payment} key={payment.id}><div className={styles.paymentLine}><span>{payment.student.fullName}</span><strong>{money(Number(payment.amount))}</strong></div><div className={styles.paymentMeta}><span>{payment.receiptNumber}</span><span>{date(payment.paidAt)}</span></div><p className={styles.paymentDescription}>{payment.charge.description}</p></article>)}</div><div className={styles.desktopPayments}><table><thead><tr><th scope="col">Student / receipt</th><th scope="col">Charge</th><th scope="col">Date</th><th scope="col" className={styles.moneyCell}>Amount</th></tr></thead><tbody>{recentPayments.map(payment => <tr key={payment.id}><td><strong>{payment.student.fullName}</strong><small>{payment.receiptNumber}</small></td><td>{payment.charge.description}</td><td>{date(payment.paidAt)}</td><td className={styles.moneyCell}><strong>{money(Number(payment.amount))}</strong></td></tr>)}</tbody></table></div></> : <div className={styles.empty}><Banknote size={25} aria-hidden="true"/><strong>No payments recorded yet</strong><p>New payment records will appear here.</p><Link className={styles.button} href="/payments/new">Record your first payment<ArrowUpRight size={14} aria-hidden="true"/></Link></div>}</section>
    <nav className={styles.resources} aria-label="Help and app"><Link className={styles.resource} href="/assistant"><MessageCircle size={18} aria-hidden="true"/><div><strong>Need a hand?</strong><span>Get guidance from your system assistant.</span></div></Link><Link className={styles.resource} href="/install"><Smartphone size={18} aria-hidden="true"/><div><strong>Your hostel on your phone</strong><span>Install the app or find installation help.</span></div></Link></nav>
  </div>;
}
