import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireStaffFinanceAccess } from "@/lib/staff-route-authorization";
import { db } from "@/lib/db";
import { readArrears } from "@/lib/arrears-reminders";
import { ArrearsForm, ArrearsAutomationForm } from "@/components/arrears-form";
import styles from "@/components/arrears-form.module.css";
export const dynamic = "force-dynamic";
export default async function ArrearsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireStaffFinanceAccess();
  const [data, settings, connection, params] = await Promise.all([
    readArrears(db, session.organizationId),
    db.communicationSettings.findUnique({ where: { organizationId: session.organizationId } }),
    db.whatsAppConnection.findUnique({ where: { organizationId: session.organizationId }, select: { enabled: true, verifiedAt: true } }),
    searchParams,
  ]);
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
  return <div className={styles.page}><header className={styles.heading}><div><h1>Overdue payments</h1><p>{rows.length} current tenant{rows.length === 1 ? "" : "s"} with overdue rent. Cleared and future balances are excluded.</p></div><Link className={styles.linkButton} href="/reports">All reports</Link></header>
    {params.error && <p role="alert" className={styles.error}>{params.error.slice(0, 400)}</p>}
    <ArrearsAutomationForm enabled={settings?.arrearsEnabled ?? false} whatsapp={settings?.arrearsWhatsappCopies ?? true} email={settings?.arrearsEmailCopies ?? false} whatsappEnabled={data.org.whatsappEnabled} emailReady={emailReady}/>
    <ArrearsForm rows={rows} requestId={randomUUID()} whatsappEnabled={data.org.whatsappEnabled} businessReady={businessReady} emailReady={emailReady}/>
    {!!data.review.length && <p className={styles.error}>{data.review.length} tenant account{data.review.length === 1 ? " needs" : "s need"} a ledger review and will not receive a payment request. <Link href="/payments/audit">Review account entries</Link></p>}
  </div>;
}
