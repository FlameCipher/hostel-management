import Link from "next/link";
import { ArrowRight, Banknote, BedDouble, ChevronDown, CircleAlert, DoorOpen, MessageCircle, ShieldCheck, Smartphone, Users, Wallet } from "lucide-react";
import { ResidentAlertPanel } from "@/components/resident-alert-panel";
import styles from "./dashboard.module.css";
import type { OwnerOperation } from "@/lib/owner-operations";

export type DashboardViewProps = {
  semester: string;
  date: string;
  dateTime: string;
  timeZone: string;
  students: number;
  rooms: number;
  occupied: number;
  vacant: number;
  collected: string;
  expected: string;
  outstanding: string;
  hasCharges: boolean;
  overdueCharges: number;
  activeSOS: number;
  overdueOutings: number;
  lateUnacknowledged: number;
  returnReported: number;
  canVerifyRegistrations: boolean;
  operations: OwnerOperation[];
  recentPayments: { id: string; student: string; amount: string; date: string; receipt: string }[];
};

const shortcuts = [
  { label: "Students", href: "/students", icon: Users },
  { label: "Rooms", href: "/rooms", icon: BedDouble },
  { label: "Payments", href: "/payments", icon: Wallet },
  { label: "Messages", href: "/communications/inbox", icon: MessageCircle },
];

export function DashboardView(props: DashboardViewProps) {
  const gateUpdates = [
    { label: "Expected returns overdue", value: props.overdueOutings },
    { label: "Late notices to review", value: props.lateUnacknowledged },
    { label: "Reported returns to verify", value: props.returnReported },
  ].filter(item => item.value > 0);

  return <div className={styles.dashboard}>
    <header className={styles.heading}>
      <div><h1>Dashboard</h1><p className={styles.context}><span>{props.semester}</span><span aria-hidden="true">·</span><time dateTime={props.dateTime} title={props.timeZone}>{props.date}</time></p></div>
      <Link className={styles.primary} href="/payments/new"><Banknote size={19} aria-hidden="true"/>Record payment</Link>
    </header>

    {props.activeSOS > 0 && <Link className={styles.emergency} href="/safety">
      <CircleAlert size={23} aria-hidden="true"/><span><strong>{props.activeSOS} active SOS request{props.activeSOS === 1 ? "" : "s"}</strong><span>Open requests and contact the student</span></span><ArrowRight size={19} aria-hidden="true"/>
    </Link>}

    <nav className={styles.shortcuts} aria-label="Quick access">
      {shortcuts.map(({ label, href, icon: Icon }) => <Link key={href} href={href}><span className={styles.shortcutIcon}><Icon size={22} aria-hidden="true"/></span><span>{label}</span><ArrowRight className={styles.shortcutArrow} size={17} aria-hidden="true"/></Link>)}
    </nav>

    <section className={styles.stats} aria-label="Hostel at a glance">
      <Link href="/students?status=ACTIVE"><strong>{props.students}</strong><span>Active students</span></Link>
      <Link href="/rooms?status=OCCUPIED"><strong>{props.occupied}<small> / {props.rooms}</small></strong><span>Rooms occupied</span></Link>
      <Link href="/rooms?status=VACANT"><strong>{props.vacant}</strong><span>Vacant rooms</span></Link>
    </section>

    <div className={styles.updates}>
      {props.canVerifyRegistrations && props.operations.length>0 ? <details className={styles.gate} aria-label="Owner activation and delivery priorities">
        <summary><CircleAlert size={19} aria-hidden="true"/><span>Operations to finish</span><span className={styles.review}>{props.operations.length} area{props.operations.length===1?"":"s"}</span><ChevronDown className={styles.chevron} size={18} aria-hidden="true"/></summary>
        <div className={styles.gateContent}>
          {props.operations.map(item=><Link key={item.key} href={item.href} aria-label={item.label}>
            <span><strong>{item.label}</strong><small className={styles.operationDetail}>{item.detail}</small></span><ArrowRight size={16} aria-hidden="true"/>
          </Link>)}
          <p>Live record counts are not proof that an invitation, receipt or emergency alert was delivered. Account approvals remain individual.</p>
        </div>
      </details>:null}
      <ResidentAlertPanel compact canVerifyRegistrations={props.canVerifyRegistrations}/>
      {gateUpdates.length > 0 && <details className={styles.gate}>
        <summary><DoorOpen size={19} aria-hidden="true"/><span>Gate updates</span><span className={styles.review}>Review</span><ChevronDown className={styles.chevron} size={18} aria-hidden="true"/></summary>
        <div className={styles.gateContent}>{gateUpdates.map(item => <Link key={item.label} href="/outings"><span>{item.label}</span><strong>{item.value}</strong><ArrowRight size={16} aria-hidden="true"/></Link>)}<p>Based on reported outings. Confirm with the student or gate team.</p></div>
      </details>}
    </div>

    <div className={styles.overview}>
      <section className={styles.card} aria-label="Rent overview">
        <header className={styles.sectionHeader}><h2>Rent overview</h2><Link href="/reports">Reports<ArrowRight size={16} aria-hidden="true"/></Link></header>
        {props.hasCharges ? <>
          <div className={styles.collected}><span>Collected</span><strong>{props.collected}</strong></div>
          <div className={styles.balance}><span>Outstanding balance</span><strong>{props.outstanding}</strong></div>
          <p className={styles.expected}>Expected rent <span>{props.expected}</span></p>
          {props.overdueCharges > 0 && <Link className={styles.overdue} href="/reports/arrears"><CircleAlert size={16} aria-hidden="true"/>{props.overdueCharges} overdue charge{props.overdueCharges === 1 ? "" : "s"}<ArrowRight size={16} aria-hidden="true"/></Link>}
        </> : <p className={styles.empty}>No rent charges recorded for this period.</p>}
      </section>

      <section className={styles.card} aria-label="Recent payments">
        <header className={styles.sectionHeader}><h2>Recent payments</h2><Link href="/payments">View all<ArrowRight size={16} aria-hidden="true"/></Link></header>
        {props.recentPayments.length ? <ul className={styles.payments}>{props.recentPayments.map(payment => <li key={payment.id}><Link href={`/payments/${payment.id}/receipt`} aria-label={`Receipt ${payment.receipt} for ${payment.student}, ${payment.amount}`}><span className={styles.paymentStudent}><strong>{payment.student}</strong><span>{payment.date}</span></span><strong className={styles.paymentAmount}>{payment.amount}</strong></Link></li>)}</ul> : <p className={styles.empty}>Your latest payments will appear here.</p>}
      </section>
    </div>

    <details className={styles.tools}>
      <summary><span>More tools</span><ChevronDown className={styles.chevron} size={19} aria-hidden="true"/></summary>
      <nav aria-label="More dashboard tools">
        <Link href="/safety"><ShieldCheck size={19} aria-hidden="true"/>Student safety</Link>
        <Link href="/outings"><DoorOpen size={19} aria-hidden="true"/>Student outings</Link>
        <Link href="/visitors"><Users size={19} aria-hidden="true"/>Visitor register</Link>
        <Link href="/communications"><MessageCircle size={19} aria-hidden="true"/>Send a notice</Link>
        <Link href="/assistant"><MessageCircle size={19} aria-hidden="true"/>Help & assistant</Link>
        <Link href="/install"><Smartphone size={19} aria-hidden="true"/>Install app</Link>
      </nav>
    </details>
  </div>;
}
