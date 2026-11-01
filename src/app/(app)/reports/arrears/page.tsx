import { readLateFees } from "@/lib/late-fees";
import { LATE_FEE_ORGANIZATION, displayHostelDate } from "@/lib/late-fee-policy";
import { formatMoney } from "@/lib/currency";
import { PaymentAgreementForm } from "@/components/payment-agreement-form";
import { tenantWhere } from "@/lib/communications";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireStaffFinanceAccess } from "@/lib/staff-route-authorization";
import { db } from "@/lib/db";
import { readArrears } from "@/lib/arrears-reminders";
import { ArrearsForm, ArrearsAutomationForm } from "@/components/arrears-form";
import styles from "@/components/arrears-form.module.css";
export const dynamic = "force-dynamic";
export default async function ArrearsPage({ searchParams }: { searchParams: Promise<{ error?: string; agreement?: string }> }) {
  const session = await requireStaffFinanceAccess();
  const [data, settings, connection, params] = await Promise.all([
    readArrears(db, session.organizationId),
    db.communicationSettings.findUnique({ where: { organizationId: session.organizationId } }),
    db.whatsAppConnection.findUnique({ where: { organizationId: session.organizationId }, select: { enabled: true, verifiedAt: true } }),
    searchParams,
  ]);
  const fees = await readLateFees(db, session.organizationId);
  const agreementStudent = params.agreement && params.agreement.length <= 128 ? await db.student.findFirst({ where: { ...tenantWhere(session.organizationId), id: params.agreement }, select: { id: true, fullName: true, paymentAgreedDate: true, paymentAgreementNote: true, paymentAgreementUpdatedAt: true } }) : null;
  const ids = data.rows.flatMap(row => row.lastNotificationId ? [row.lastNotificationId] : []);
  const [notifications, deliveries] = await Promise.all([
    db.notification.findMany({ where: { organizationId: session.organizationId, id: { in: ids } }, select: { id: true, status: true } }),
    db.whatsAppDelivery.findMany({ where: { organizationId: session.organizationId, notificationId: { in: ids } }, select: { notificationId: true, status: true } }),
  ]);
  const emailReady = !!(process.env.RESEND_API_KEY && process.env.RECEIPT_EMAIL_FROM);
  const businessReady = !!(data.org.whatsappEnabled && connection?.enabled && connection.verifiedAt && process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && process.env.SERVICE_ENCRYPTION_KEY);
  const rows = data.rows.map(row => {
    const n = notifications.find(n => n.id === row.lastNotificationId), d = deliveries.find(d => d.notificationId === row.lastNotificationId);
    const labels: Record<string, string> = { QUEUED: "WhatsApp queued", SENDING: "WhatsApp sending", ACCEPTED: "WhatsApp provider accepted", SENT: "WhatsApp sent", DELIVERED: "WhatsApp delivered", READ: "WhatsApp read", FAILED: "WhatsApp failed", REVIEW: "WhatsApp needs review", CANCELLED: "WhatsApp cancelled" };
    const manual: Record<string, string> = { QUEUED: "WhatsApp ready to forward", OPENED_FOR_SENDING: "WhatsApp opened — send unconfirmed", SENT: "Marked sent manually", CANCELLED: "Request cancelled", FAILED: "WhatsApp needs attention" };
    return { ...row, delivery: d ? labels[d.status] ?? d.status : n ? manual[n.status] ?? n.status : row.lastAt ? (row.lastRead ? "Read in tenant account" : "Saved in tenant account") : "No payment request yet" };
  });
  return <div className={styles.page}><header className={styles.heading}><div><h1>Unpaid rent reminders</h1><p>{rows.length} current tenant{rows.length === 1 ? "" : "s"} with overdue rent. Cleared balances, future charges and approved payment extensions are excluded.</p></div><div><Link className={styles.linkButton} href="/reports/unpaid">Share unpaid list as PDF</Link> <Link className={styles.linkButton} href="/reports">All reports</Link></div></header>
    {params.error && <p role="alert" className={styles.error}>{params.error.slice(0, 400)}</p>}
    {agreementStudent && <PaymentAgreementForm key={agreementStudent.id + (agreementStudent.paymentAgreementUpdatedAt?.toISOString() ?? "")} student={{ id: agreementStudent.id, name: agreementStudent.fullName, date: agreementStudent.paymentAgreedDate?.toISOString().slice(0,10) ?? "", note: agreementStudent.paymentAgreementNote ?? "", updatedAt: agreementStudent.paymentAgreementUpdatedAt?.toISOString() ?? "" }}/>}
    {params.agreement && !agreementStudent && <p role="alert">Current tenant not found.</p>}
    <ArrearsForm rows={rows} requestId={randomUUID()} sponsorRequestId={randomUUID()} whatsappEnabled={data.org.whatsappEnabled} businessReady={businessReady} emailReady={emailReady}/>
    {session.organizationId === LATE_FEE_ORGANIZATION && <details className="panel entity-form"><summary>Late-payment policy and student terms</summary><h2>One-time late-payment charge · 10%</h2><p>The daily check applies 10% once to unpaid semester rent after the student accepts the new terms and their automatic deadline passes. Approved extensions take priority. No fee is added to another fee.</p><p>Notice dates and payment deadlines come from the system. You do not need to type dates into rent reminders.</p><Link href="/student-terms">Review student acceptance of the updated terms</Link><details><summary>Review late-payment status ({fees.length} rent charges)</summary>{fees.map(f => <p key={f.chargeId}><strong>{f.name}</strong> · {f.state}{f.deadline ? ` · Deadline ${displayHostelDate(f.deadline)}` : ""}{f.eligible ? ` · Fee ${formatMoney(f.fee,f.currency)}` : ""}</p>)}</details></details>}
    <ArrearsAutomationForm enabled={settings?.arrearsEnabled ?? false} whatsapp={settings?.arrearsWhatsappCopies ?? true} email={settings?.arrearsEmailCopies ?? false} whatsappEnabled={data.org.whatsappEnabled} emailReady={emailReady}/>

    {!!data.deferred.length && <section><h2>Agreed payment dates · {data.deferred.length}</h2><p>These students are excluded from rent reminders through the dates below.</p><div className={styles.list}>{data.deferred.map(row => <article className={styles.tenant} key={row.studentId}><div className={styles.tenantHeader}><span><strong>{row.name}</strong><small>Room {row.room || "—"} · Agreed until {row.agreedDate}</small></span><strong>{row.balance}</strong></div><p>{row.note}</p><Link href={`/reports/arrears?agreement=${encodeURIComponent(row.studentId)}`}>Review agreement</Link></article>)}</div></section>}
    {!!data.review.length && <p className={styles.error}>{data.review.length} tenant account{data.review.length === 1 ? " needs" : "s need"} a ledger review and will not receive a payment request. <Link href="/payments/audit">Review account entries</Link></p>}
  </div>;
}
