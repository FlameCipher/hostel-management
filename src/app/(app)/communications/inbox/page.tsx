import styles from "@/components/resident-services.module.css";
import { tenantWhere } from "@/lib/communications";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { communicationManager } from "@/lib/communications";
import { ContactForm } from "@/components/contact-form";
export const dynamic="force-dynamic";
export default async function ManagementInboxPage({searchParams}:{searchParams:Promise<{page?:string}>}){
 const params=await searchParams;const page=Math.min(10000,Math.max(1,Math.floor(Number(params.page)||1)));
 const s=await requireSession();if(!(await communicationManager(db,s)))return <section className="panel"><h1>Inbox unavailable</h1><p>Only active owners, administrators and managers may access student conversations.</p></section>;
 const conversations=await db.tenantConversation.findMany({where:{organizationId:s.organizationId,student:{organizationId:s.organizationId}},orderBy:[{updatedAt:"desc"},{id:"desc"}],skip:(page-1)*50,take:51,include:{student:{select:{fullName:true}},entries:{orderBy:{createdAt:"desc"},take:50}}});
 const tenants=await db.student.findMany({where:{...tenantWhere(s.organizationId),portalEnabled:true,portalPasswordHash:{not:null}},select:{id:true,fullName:true},orderBy:{fullName:"asc"}});
 return <div className={styles.page}><div className="page-heading-row"><div><h1>Student inbox</h1><p>Private student conversations. Open threads are awaiting management.</p></div><Link className="secondary-button" href="/communications">Communication centre</Link></div><section className={`panel ${styles.card}`}><h2>Start a private conversation</h2><ContactForm requestId={randomUUID()} manager tenants={tenants}/></section>{conversations.length?conversations.slice(0,50).map(c=><section className={`panel ${styles.card}`} key={c.id}><h2>{c.subject}</h2><small>Latest 50 messages in this conversation</small><strong>{c.student.fullName} · {c.category} · {c.status==="OPEN"?"Awaiting management":"Replied"}</strong>{[...c.entries].reverse().map(e=><article key={e.id}><strong>{e.author==="STUDENT"?c.student.fullName:"Management"}</strong><small> · {e.createdAt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})}</small><p style={{whiteSpace:"pre-wrap"}}>{e.body}</p></article>)}<ContactForm requestId={randomUUID()} conversationId={c.id} manager/></section>):<section className="panel"><p>No student conversations yet.</p></section>}<nav className="row-actions mt-5" aria-label="Conversation pages">{page>1?<Link className="secondary-button" href={`/communications/inbox?page=${page-1}`}>Previous conversations</Link>:null}{conversations.length>50?<Link className="secondary-button" href={`/communications/inbox?page=${page+1}`}>Older conversations</Link>:null}</nav></div>;
}
