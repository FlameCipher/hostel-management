import Link from "next/link";
import { recordWhatsAppPermission } from "./connection-actions";
import { WhatsAppConnectionForm } from "@/components/whatsapp-connection-form";
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
  const connection=manager?await db.whatsAppConnection.findUnique({where:{organizationId:session.organizationId},select:{displayPhone:true,enabled:true,templateName:true}}):null;
  const permissions=manager?await db.whatsAppConsent.findMany({where:{organizationId:session.organizationId},select:{accountId:true,audience:true,enabled:true}}):[];
  const deliveries=manager?await db.whatsAppDelivery.findMany({where:{organizationId:session.organizationId},orderBy:{createdAt:"desc"},take:30}):[];
  const itemDeliveries=manager?await db.whatsAppDelivery.findMany({where:{organizationId:session.organizationId,notificationId:{in:items.map(item=>item.id)}},select:{notificationId:true,status:true}}):[];
  const cloudStatus=new Map(itemDeliveries.map(d=>[d.notificationId,d.status]));
  return <div className={styles.page}>
    <div className="page-heading-row"><div><p className="eyebrow">Tenant and staff communication</p><h1>WhatsApp</h1><p>Private conversations between your hostel management, current tenants and staff.</p></div>{manager && <Link className="secondary-button" href="/communications">Communication centre</Link>}</div>
    <section className={`panel ${styles.contactPanel}`}><h2>Contact hostel management</h2>
      <p>Tenants and staff can start a WhatsApp chat with the hostel contact below. Replies stay in WhatsApp.</p>
      <div className={styles.actions}>{contacts.map(c => <a className="secondary-button" key={c.number} href={c.href} target="_blank" rel="noopener noreferrer">WhatsApp {c.name} · +{c.number}</a>)}</div>
      {!contacts.length && <p>{organization.whatsappEnabled ? "Management must save a valid international contact number in Settings or the property profile." : "WhatsApp is disabled for this hostel in Settings."}</p>}
      <p className={styles.note}>Manual drafts use WhatsApp on your device. Automatic delivery requires this hostel’s verified business sender and recipient opt-in. Replies remain in WhatsApp; private portal conversations are separate.</p>
    </section>
    {manager && <>
      {["OWNER","ADMIN"].includes(session.role)&&<WhatsAppConnectionForm connection={connection}/>}
      <section className={`panel ${styles.draft}`}><h2>Automatic delivery status</h2><p>Accepted means Meta accepted the message. Delivered and Read require a verified provider callback. Review means the outcome is uncertain and needs reconciliation before retrying.</p>{deliveries.length?deliveries.map(d=><p key={d.id}><strong>{d.status}</strong> · {d.createdAt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})}{d.error?` · ${d.error}`:""}</p>):<p>No automatic deliveries yet.</p>}</section>
      <details className={`panel ${styles.draft}`}><summary>Record recipient WhatsApp permission</summary><p>Use this only when the person has explicitly agreed. Record how and when permission was obtained. Recipients can also manage their preference in their own account.</p>{[...tenants.map(t=>({id:t.id,name:t.fullName,audience:"tenant"})),...staff.map(s=>({id:s.id,name:s.name,audience:"staff"}))].map(person=><form action={recordWhatsAppPermission} key={`${person.audience}:${person.id}`} className={styles.compose}><h3>{person.name}</h3><p>{permissions.find(p=>p.accountId===person.id&&p.audience===person.audience)?.enabled?"Permission recorded":"Permission not recorded"}</p><input type="hidden" name="accountId" value={person.id}/><input type="hidden" name="audience" value={person.audience}/><label className="field-group"><span>Permission evidence (date and method)</span><input name="evidence" minLength={5} maxLength={300}/></label><label><input type="checkbox" name="confirmed"/> I obtained this person’s permission for hostel WhatsApp updates.</label><label><input type="checkbox" name="enabled"/> Allow automatic updates; leave unchecked to record withdrawal.</label><button className="secondary-button">Save permission</button></form>)}</details>
      {params.error && <p className={styles.error} role="alert">{params.error.slice(0, 300)}</p>}
      {organization.whatsappEnabled ? <WhatsAppDraftForm automatic={!!connection?.enabled} requestId={randomUUID()} tenants={tenants.map(t => ({ id: t.id, name: t.fullName, phone: t.phone }))} staff={staff}/> : <section className="panel"><p>Enable WhatsApp in <Link href="/settings">Settings</Link> to prepare messages.</p></section>}
      <section className={styles.history} aria-label="WhatsApp drafts"><h2>WhatsApp drafts and history</h2><p>Opening a draft does not send it. Mark it sent only after sending it in WhatsApp; this is a manual record, not a delivery receipt.</p>
        {items.length ? items.slice(0, 30).map(item => <article className={`panel ${styles.draft}`} key={item.id}>
          <header><div><h3>{item.recipientName}</h3><p>{item.recipientType === "STAFF" ? "Staff" : item.recipientType === "GUARDIAN" ? "Guardian" : "Tenant"} · {item.recipientPhone}</p></div><strong className={styles.status}>{cloudStatus.has(item.id)?`Automatic: ${cloudStatus.get(item.id)}`:manualDeliveryLabels[item.status]}</strong></header>
          <p className={styles.message}>{item.message}</p>
          {item.failureReason && <p className={styles.error}>{item.failureReason}</p>}
          {!["SENDING","ACCEPTED","SENT","DELIVERED","READ","REVIEW"].includes(cloudStatus.get(item.id)??"") && !["SENT", "CANCELLED"].includes(item.status) && item.scheduledAt <= new Date() && <div className={styles.actions}>
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
