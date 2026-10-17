import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { residentTenant } from "@/lib/resident-access";
import { StudentSOSButton } from "@/components/student-sos-button";
import { sosPilotEnabled } from "@/lib/student-safety";
export const dynamic="force-dynamic";
export const metadata={title:"My safety SOS",robots:{index:false,follow:false}};

export default async function TenantSafetyPage(){
 const session=await requireTenantSession();
 if(!await residentTenant(db,session))return <main className="marketing-section">
   <h1>Emergency safety</h1>
   <p>Your hostel account does not currently qualify to submit an in-app incident.
      In danger? Call <a href="tel:999">999</a> or <a href="tel:112">112</a> now.</p>
   <Link href="/tenant/login">Student login</Link>
 </main>;
 const history=await db.safetyAlert.findMany({
   where:{organizationId:session.organizationId,studentId:session.studentId},
   select:{id:true,status:true,createdAt:true,acknowledgedAt:true,closedAt:true},
   orderBy:{createdAt:"desc"},take:10,
 });
 return <main className="marketing-section">
   <div className="page-heading-row"><div><p className="eyebrow">MMAMBUGUA HOSTEL · Student safety</p>
     <h1>Danger / SOS</h1><p>Your alert goes into the hostel staff response queue.</p></div>
     <Link href="/tenant/account" className="secondary-button">My portal</Link>
   </div>
   {sosPilotEnabled(session.organizationId)?
     <StudentSOSButton requestId={randomUUID()}/>:
     <section className="panel entity-form">
       <h2>Emergency calling available — hostel SOS pilot not activated</h2>
       <p>The hostel has not yet completed its staffed emergency response test.
         You cannot currently submit an in-app alert. For urgent emergencies call
         <a href="tel:999">999</a> or <a href="tel:112">112</a>, or contact a trusted person directly.</p>
       <p>After the hostel verifies named responders and safe incident handling,
         the SOS button can be enabled. This page does not monitor your location.</p>
     </section>}
   <section className="panel entity-form mt-5">
     <h2>My recent SOS requests</h2>
     <p>OPEN means only that the system saved your alert, not that anyone is on the way.
        ACKNOWLEDGED means staff recorded a response action; only a direct conversation confirms actual help.</p>
     {history.length?history.map(item=><p key={item.id}>
       <strong>{item.status}</strong> · {item.createdAt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})}
       {item.acknowledgedAt?" · Staff acknowledged":""}
       {item.closedAt?" · Staff closed incident record":""}
     </p>):<p>No SOS alerts recorded for this account.</p>}
   </section>
 </main>;
}
