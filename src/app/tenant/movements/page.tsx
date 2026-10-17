import Link from "next/link";
import {randomUUID} from "node:crypto";
import {requireTenantSession} from "@/lib/auth/tenant-session";
import {residentTenant} from "@/lib/resident-access";
import {db} from "@/lib/db";
import {hostelTimeZone} from "@/lib/resident-policy";
import {outingAttention} from "@/lib/student-outings";
import {StudentMovementForms} from "@/components/student-movement-forms";

export const dynamic="force-dynamic";
export const metadata={title:"My outings and returns",robots:{index:false,follow:false}};

export default async function TenantMovementsPage(){
 const session=await requireTenantSession();
 if(!await residentTenant(db,session))return <main className="marketing-section">
  <h1>My outings</h1><p>Only students with active hostel accounts and allocations can share return updates.</p>
  <Link href="/tenant/account">My portal</Link>
 </main>;
 const organizationId=session.organizationId,studentId=session.studentId,now=new Date();
 const [stays,current,history]=await Promise.all([
  db.occupancy.findMany({where:{organizationId,studentId,status:"ACTIVE",semester:{organizationId},
    room:{organizationId,property:{organizationId,active:true}}},
    select:{room:{select:{number:true,property:{select:{name:true,timeZone:true,countryCode:true}}}}},
    take:2}),
  db.studentOuting.findFirst({where:{organizationId,studentId,
    status:{in:["OUT","RETURN_REPORTED"]}},
    orderBy:{createdAt:"desc"},select:{id:true,status:true,leftAt:true,expectedReturnAt:true,
      lateNotifiedAt:true,lateAcknowledgedAt:true,studentReturnedAt:true,roomLabel:true}}),
  db.studentOuting.findMany({where:{organizationId,studentId},
    select:{id:true,status:true,leftAt:true,expectedReturnAt:true,lateNotifiedAt:true,
      lateAcknowledgedAt:true,studentReturnedAt:true,verifiedReturnAt:true,roomLabel:true},
    orderBy:{createdAt:"desc"},take:12}),
 ]);
 const room=stays[0]?.room;
 const tz=hostelTimeZone(room?.property.timeZone,room?.property.countryCode);
 const localeDate=(v:Date)=>v.toLocaleString("en-KE",{timeZone:tz,dateStyle:"medium",timeStyle:"short"});
 const attention=current?outingAttention({...current,studentReturnedAt:current.studentReturnedAt},now):null;
 return <main className="marketing-section">
   <div className="page-heading-row"><div>
     <p className="eyebrow">Student self-reported travel · {room?.property.name??"Your hostel"}</p>
     <h1>Going out &amp; returning</h1>
     <p>Help security prepare for your arrival, especially when you expect to return after normal hours.</p>
   </div><Link className="secondary-button" href="/tenant/account">My portal</Link></div>
   <section className="policy-banner mt-5"><div>
     <strong>Your updates are not automatic tracking.</strong>
     <p>Only you report when you leave, expect to return or have arrived.
       The hostel cannot know your actual whereabouts from these records.
       A late notice is a request for security coordination, not confirmed approval.
       For urgent danger, use emergency calling or the separate hostel SOS system.</p>
     <Link href="/tenant/safety" className="secondary-button">Emergency and SOS information</Link>
   </div></section>
   {current?<section className="panel entity-form mt-5">
     <h2>{current.status==="OUT"?"Outside — according to your report":"Return reported — not gate verified"}</h2>
     <p>Room {current.roomLabel} · Leaving reported {localeDate(current.leftAt)}.
       Expected return {localeDate(current.expectedReturnAt)}.</p>
     {attention?.overdueUnconfirmed?<p className="form-error" role="status">
       Your expected return time has passed without a confirmed return report.
       This does not prove you are missing or still outside.</p>:null}
     {attention?.lateNoticeUnacknowledged?<p role="status">Late notice saved, but no staff acknowledgement recorded. Contact the gate directly if necessary.</p>:null}
     {current.lateNotifiedAt && current.lateAcknowledgedAt?<p role="status">A gate staff member recorded reviewing your late notice; this does not guarantee access.</p>:null}
   </section>:null}
   {stays.length===1?
     <StudentMovementForms requestId={randomUUID()} timeZone={tz}
       current={current?{
         id:current.id,status:current.status,expectedReturnAt:current.expectedReturnAt.toISOString(),
         lateNotifiedAt:current.lateNotifiedAt?.toISOString()??null,
       }:null}/>:
     <section className="panel entity-form"><p>Your active hostel room is not uniquely recorded. Ask management to review your room before posting an outing.</p></section>}
   <section className="panel entity-form mt-5">
     <h2>My recent updates</h2>
     {history.length?history.map(item=><p key={item.id}>
       <strong>{item.status==="OUT"?"Reported out":item.status==="RETURN_REPORTED"?
         "Return reported — gate not verified":"Gate return verified"}</strong>
       · Room {item.roomLabel} · {localeDate(item.leftAt)}
       · Expected {localeDate(item.expectedReturnAt)}
       {item.lateNotifiedAt?" · Late notice posted":""}
       {item.verifiedReturnAt?" · Actual gate return recorded by staff":""}
     </p>):<p>No outings have been reported yet. This is not evidence of where you currently are.</p>}
   </section>
 </main>;
}
