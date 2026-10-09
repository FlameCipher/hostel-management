import Link from "next/link";
import { communicationManager } from "@/lib/communications";
import { manualDeliveryLabels } from "@/lib/whatsapp-policy";
import { Bell, Check, ExternalLink, X } from "lucide-react";
import { ReminderForm } from "@/components/reminder-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { cancelReminderAction, markReminderSentAction, openReminderAction } from "./actions";

export default async function NotificationsPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const session = await requireSession();
  if (!await communicationManager(db, session)) return <section className="panel"><h1>Management reminders</h1><p>Only management can prepare or view reminder messages.</p><Link href="/communications/whatsapp">Contact management on WhatsApp</Link></section>;
  const {error}=await searchParams;
  const [students, items, organization] = await Promise.all([
    db.student.findMany({ where: { organizationId: session.organizationId, status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    db.notification.findMany({ where: { organizationId: session.organizationId }, include: { student: true, createdBy: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.organization.findUniqueOrThrow({ where: { id: session.organizationId }, select: { name: true, whatsappEnabled: true, smsEnabled: true } }),
  ]);

  return <div>
    <div className="page-heading-row"><div><p className="eyebrow">Communication</p><h1>Reminders</h1><p>Prepare balance reminders for students and guardians through WhatsApp or SMS.</p></div></div>
    <p className="mb-4"><Link className="secondary-button" href="/communications/whatsapp">WhatsApp tenants and staff</Link></p>{error&&<p className="form-error" role="alert">{error.slice(0,300)}</p>}
    <ReminderForm organizationName={organization.name} smsEnabled={organization.smsEnabled} students={students.map((student) => ({ id: student.id, label: student.fullName }))} whatsappEnabled={organization.whatsappEnabled} />
    <section className="panel mt-5 overflow-hidden">
      <div className="panel-heading"><div><p className="panel-kicker">Delivery history</p><h2>{items.length} reminder{items.length === 1 ? "" : "s"}</h2></div><Bell size={18} /></div>
      {items.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Recipient</th><th>Channel</th><th>Message</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}>
        <td><strong>{item.recipientName}</strong><small className="table-subtext">{item.recipientPhone}</small></td><td>{item.channel}</td><td><span className="message-preview">{item.message}</span></td><td><span className={`status-pill ${item.status === "SENT" ? "status-full" : item.status === "CANCELLED" ? "status-inactive" : "status-partial"}`}>{item.channel === "WHATSAPP" ? manualDeliveryLabels[item.status] : item.status === "SENT" ? "Marked sent manually" : item.status.replaceAll("_", " ")}</span></td><td>{item.createdAt.toLocaleDateString("en-KE")}</td>
        <td><div className="row-actions">{!["SENT", "CANCELLED"].includes(item.status) ? <><form action={openReminderAction}><input name="notificationId" type="hidden" value={item.id} /><button className="table-action" type="submit"><ExternalLink size={13} /> Open</button></form>{item.status === "OPENED_FOR_SENDING" && <form action={markReminderSentAction}><input name="notificationId" type="hidden" value={item.id} /><button className="table-action" type="submit"><Check size={13} /> I sent this</button></form>}<form action={cancelReminderAction}><input name="notificationId" type="hidden" value={item.id} /><button aria-label={`Cancel reminder for ${item.recipientName}`} className="table-action danger-link" type="submit"><X size={13} /></button></form></> : null}</div></td>
      </tr>)}</tbody></table></div> : <div className="inline-empty"><Bell size={25} /><strong>No reminders yet</strong></div>}
    </section>
  </div>;
}
