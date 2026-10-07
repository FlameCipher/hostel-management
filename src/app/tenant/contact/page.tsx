import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { tenantContactAccount } from "@/lib/tenant-conversations";
import { ContactForm } from "@/components/contact-form";
export const dynamic="force-dynamic";
export const metadata={title:"Contact hostel management",robots:{index:false,follow:false}};
export default async function ContactPage({searchParams}:{searchParams:Promise<{page?:string}>}){
 const params=await searchParams;const page=Math.min(10000,Math.max(1,Math.floor(Number(params.page)||1)));
 const s=await requireTenantSession();if(!(await tenantContactAccount(db,s)))return <main className="marketing-section"><h1>Contact unavailable</h1><p>Messaging requires an enabled current tenant account.</p><Link href="/tenant/account">My account</Link></main>;
 const conversations=await db.tenantConversation.findMany({where:{organizationId:s.organizationId,studentId:s.studentId},orderBy:[{updatedAt:"desc"},{id:"desc"}],skip:(page-1)*30,take:31,include:{entries:{orderBy:{createdAt:"desc"},take:50}}});
 return <main className="marketing-section"><div className="page-heading-row"><h1>Contact management</h1><Link className="secondary-button" href="/tenant/account">My account</Link></div><section className="panel entity-form"><p>Send a private question, complaint or request to management. Other students cannot see your conversations. For emergencies, call management directly on 0714 464 701; this inbox is not continuously monitored.</p><ContactForm requestId={randomUUID()}/></section><h2 className="mt-5">My conversations</h2>{conversations.slice(0,30).map(c=><section key={c.id} className="panel entity-form mt-5"><h2>{c.subject}</h2><small>Latest 50 messages in this conversation</small><small>{c.category} · {c.status==="OPEN"?"Awaiting management":"Management replied"}</small>{[...c.entries].reverse().map(e=><article key={e.id}><strong>{e.author==="STUDENT"?"You":"Management"}</strong><small> · {e.createdAt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})}</small><p style={{whiteSpace:"pre-wrap"}}>{e.body}</p></article>)}<ContactForm requestId={randomUUID()} conversationId={c.id}/></section>)}<nav className="row-actions mt-5" aria-label="Conversation pages">{page>1?<Link className="secondary-button" href={`/tenant/contact?page=${page-1}`}>Previous conversations</Link>:null}{conversations.length>30?<Link className="secondary-button" href={`/tenant/contact?page=${page+1}`}>Older conversations</Link>:null}</nav></main>;
}
