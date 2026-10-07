import Link from "next/link";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { tenantWhere } from "@/lib/communications";
import { readMessageAction } from "./actions";
export const dynamic="force-dynamic";
export const metadata={title:"My hostel messages",robots:{index:false,follow:false}};
export default async function TenantMessagesPage(){
 const s=await requireTenantSession();
 const student=await db.student.findFirst({where:{...tenantWhere(s.organizationId),id:s.studentId,portalEnabled:true},select:{id:true}});
 if(!student)return <main className="marketing-section"><h1>Messages unavailable</h1><p>This inbox is for current tenants with enabled portal access.</p><Link href="/tenant/account">My account</Link></main>;
 const items=await db.tenantMessage.findMany({where:{organizationId:s.organizationId,studentId:s.studentId,publishAt:{lte:new Date()}},orderBy:{publishAt:"desc"},take:100});
 return <main className="marketing-section"><div className="page-heading-row"><h1>My hostel messages</h1><Link className="secondary-button" href="/tenant/account">My account</Link></div><p>Latest 100 notices addressed to you by management.</p>{items.length?items.map(m=><article className="panel entity-form mt-5" key={m.id}><h2>{m.title}</h2><small>{m.publishAt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})} · {m.readAt?"Read":"Unread"}</small><p style={{whiteSpace:"pre-wrap"}}>{m.body}</p>{!m.readAt?<form action={readMessageAction}><input type="hidden" name="id" value={m.id}/><button className="secondary-button">Mark as read</button></form>:null}</article>):<section className="panel entity-form"><p>No messages yet.</p></section>}</main>;
}
