import { OpenMessageButton } from "./open-message-button";
import Link from "next/link";
import type { MessageDeliveryReport as Report } from "@/lib/message-delivery";
import styles from "./arrears-form.module.css";
export function MessageDeliveryReport({report}:{report:Report}) {
 return <section className={styles.sendBox} aria-label="Message delivery report"><h2>Results for {report.total} recipient{report.total===1?"":"s"}</h2>
 <p role="status"><strong>WhatsApp: {report.sent} sent · {report.delivered} delivered · {report.queued} processing · {report.attention} need attention</strong></p>
 <p>Delivered is included in sent. Only WhatsApp provider confirmations count as sent. Student inbox and email results are shown separately.</p>
 {!report.ready && <p>Automatic WhatsApp is not connected. <Link href="/communications/whatsapp">Connect WhatsApp</Link>. Until connected, open each draft and send it yourself.</p>}
 <Link href={`/communications/delivery?batch=${encodeURIComponent(report.reportId)}`}>Refresh delivery results</Link>
 <div className={styles.list}>{report.rows.map(row=><article className={styles.tenant} key={row.id}><strong>Student: {row.name}</strong><p>To: {row.recipient}</p><p>{row.whatsapp.label}</p>{row.canOpen&&row.notificationId&&<OpenMessageButton id={row.notificationId}/>}<p>Student inbox: {row.portal}</p><p>Email: {row.email}</p></article>)}</div>
 </section>;
}
