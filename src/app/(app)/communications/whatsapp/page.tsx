import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { communicationManager, tenantWhere } from "@/lib/communications";
import { managementWhatsAppContacts } from "@/lib/whatsapp-communications";
import { manualDeliveryLabels } from "@/lib/whatsapp-policy";
import { WhatsAppDraftForm } from "@/components/whatsapp-draft-form";
import { updateWhatsAppDraftAction } from "./actions";
import styles from "./whatsapp.module.css";
export const metadata = { title: "WhatsApp communication", robots: { index: false, follow: false } };
export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ error?: string; page?: string }> }) {
  const session = await requireSession(), params = await searchParams;
  const manager = await communicationManager(db, session), contacts = await managementWhatsAppContacts(db, session.organizationId);
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const [tenants, staff, items, organization] = await Promise.all([
    manager ? db.student.findMany({ where: tenantWhere(session.organizationId), select: { id: true, fullName: true, phone: true }, orderBy: { fullName: "asc" }, take: 500 }) : [],
    manager ? db.user.findMany({ where: { organizationId: session.organizationId, active: true }, select: { id: true, name: true, phone: true }, orderBy: { name: "asc" }, take: 500 }) : [],
    manager ? db.notification.findMany({ where: { organizationId: session.organizationId, channel: "WHATSAPP" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 30, take: 31 }) : [],
    db.organization.findUniqueOrThrow({ where: { id: session.organizationId }, select: { whatsappEnabled: true } }),
  ]);
  return <div className={styles.page}>
    <div className="page-heading-row"><div><p className="eyebrow">Tenant and staff communication</p><h1>WhatsApp</h1><p>Private conversations between your hostel management, current tenants and staff.</p></div>{manager && <Link className="secondary-button" href="/communications">Communication centre</Link>}</div>
    <section className={`panel ${styles.contactPanel}`}><h2>Contact hostel management</h2>
      <p>Tenants and staff can start a WhatsApp chat with the hostel contact below. Replies stay in WhatsApp.</p>
      <div className={styles.actions}>{contacts.map(c => <a className="secondary-button" key={c.number} href={c.href} target="_blank" rel="noopener noreferrer">WhatsApp {c.name} · +{c.number}</a>)}</div>
      {!contacts.length && <p>{organization.whatsappEnabled ? "Management must save a valid international contact number in Settings or the property profile." : "WhatsApp is disabled for this hostel in Settings."}</p>}
      <p className={styles.note}>Manual WhatsApp is available now. Automatic sending, verified delivery/read status and replies inside this dashboard are not connected.</p>
    </section>
    {manager && <>
      {params.error && <p className={styles.error} role="alert">{params.error.slice(0, 300)}</p>}
      {organization.whatsappEnabled ? <WhatsAppDraftForm requestId={randomUUID()} tenants={tenants.map(t => ({ id: t.id, name: t.fullName, phone: t.phone }))} staff={staff}/> : <section className="panel"><p>Enable WhatsApp in <Link href="/settings">Settings</Link> to prepare messages.</p></section>}
      <section className={styles.history} aria-label="WhatsApp drafts"><h2>WhatsApp drafts and history</h2><p>Opening a draft does not send it. Mark it sent only after sending it in WhatsApp; this is a manual record, not a delivery receipt.</p>
        {items.length ? items.slice(0, 30).map(item => <article className={`panel ${styles.draft}`} key={item.id}>
          <header><div><h3>{item.recipientName}</h3><p>{item.recipientType === "STAFF" ? "Staff" : item.recipientType === "GUARDIAN" ? "Guardian" : "Tenant"} · {item.recipientPhone}</p></div><strong className={styles.status}>{manualDeliveryLabels[item.status]}</strong></header>
          <p className={styles.message}>{item.message}</p>
          {item.failureReason && <p className={styles.error}>{item.failureReason}</p>}
          {!["SENT", "CANCELLED"].includes(item.status) && item.scheduledAt <= new Date() && <div className={styles.actions}>
            <form action={updateWhatsAppDraftAction} target="_blank"><input type="hidden" name="id" value={item.id}/><button className="primary-button" name="action" value="OPEN">Open in WhatsApp</button></form>
            {item.status === "OPENED_FOR_SENDING" && <form action={updateWhatsAppDraftAction}><input type="hidden" name="id" value={item.id}/><button className="secondary-button" name="action" value="SENT">I sent this message</button></form>}
            {item.status === "OPENED_FOR_SENDING" && <form action={updateWhatsAppDraftAction}><input type="hidden" name="id" value={item.id}/><button className="secondary-button" name="action" value="FAILED">Could not send</button></form>}
            <form action={updateWhatsAppDraftAction}><input type="hidden" name="id" value={item.id}/><button className="secondary-button" name="action" value="CANCEL">Cancel draft</button></form>
          </div>}
        </article>) : <div className={`panel ${styles.draft}`}><p>No WhatsApp drafts yet. Prepare a tenant or staff message above.</p></div>}
        <p><Link href="/communications/whatsapp">Refresh draft status</Link> after returning from WhatsApp.</p>
        <nav className={styles.actions} aria-label="WhatsApp history pages"><span>Page {page}</span>{page > 1 && <Link className="secondary-button" href={`/communications/whatsapp?page=${page-1}`}>Previous</Link>}{items.length > 30 && <Link className="secondary-button" href={`/communications/whatsapp?page=${page+1}`}>Next</Link>}</nav>
      </section>
    </>}
  </div>;
}
