import Link from "next/link";
import {requireSession} from "@/lib/auth/session";
import {residentStaff} from "@/lib/resident-access";
import {db} from "@/lib/db";
import {registeredResidentCallTarget} from "@/lib/tenant-verification-contact";
import {outingAttention} from "@/lib/student-outings";
import {hostelTimeZone} from "@/lib/resident-policy";
import {StaffOutingControls} from "@/components/staff-outing-controls";
import {SafetyQueueRefresh} from "@/components/safety-queue-refresh";
import {DeviceReminderOptIn} from "@/components/device-reminder-optin";

export const dynamic="force-dynamic";
export const metadata={title:"Student departures and returns",robots:{index:false,follow:false}};
export default async function StaffOutingsPage({searchParams}:{
 searchParams:Promise<{page?:string;property?:string;filter?:string}>
}){
 const session=await requireSession(), staff=await residentStaff(db,session);
 if(!staff)return <section className="panel"><h1>Gate updates unavailable</h1>
   <p>Use an authorized hostel staff account.</p></section>;
 const params=await searchParams,organizationId=session.organizationId,now=new Date();
 const page=Math.max(1,Math.min(1000,Number(params.page)||1));
 const properties=await db.property.findMany({where:{organizationId,active:true},
   select:{id:true,name:true,countryCode:true,timeZone:true},orderBy:{name:"asc"}});
 const propertyId=properties.some(p=>p.id===params.property)?params.property:undefined;
 const scope={organizationId,...(propertyId?{propertyId}:{})};
 const [current,unconfirmed,late,returns]=await Promise.all([
  db.studentOuting.findMany({where:{...scope,status:{in:["OUT","RETURN_REPORTED"]}},
    select:{id:true,status:true,propertyId:true,roomLabel:true,leftAt:true,expectedReturnAt:true,
      initialExpectedReturnAt:true,lateNotifiedAt:true,lateMessage:true,lateAcknowledgedAt:true,
      studentReturnedAt:true,student:{select:{fullName:true,phone:true}}},
    orderBy:[{expectedReturnAt:"asc"},{id:"asc"}],skip:(page-1)*30,take:31}),
  db.studentOuting.count({where:{...scope,status:"OUT",expectedReturnAt:{lt:now}}}),
  db.studentOuting.count({where:{...scope,status:"OUT",lateNotifiedAt:{not:null},lateAcknowledgedAt:null}}),
  db.studentOuting.count({where:{...scope,status:"RETURN_REPORTED"}}),
 ]);
 const byProperty=new Map(properties.map(p=>[p.id,p]));
 const link=(next:number)=>"?"+new URLSearchParams({...((propertyId&&{property:propertyId})||{}),page:String(next)});
 return <div>
  <div className="page-heading-row"><div>
    <p className="eyebrow">Hostel gate operations</p>
    <h1>Going out, late returns &amp; arrivals</h1>
    <p>Only student-submitted travel intentions and staff-verified arrival records are shown.
      No background location tracking.</p>
  </div><div className="heading-actions">
    <Link href="/visitors" className="secondary-button">Visitors</Link>
    <Link href="/safety" className="secondary-button">Emergency SOS</Link>
  </div></div>
  <section className="room-summary-grid mt-5">
    <article className="compact-stat"><div><p>Return time overdue — no confirmed return</p><strong>{unconfirmed}</strong></div></article>
    <article className="compact-stat"><div><p>Late notices unacknowledged</p><strong>{late}</strong></div></article>
    <article className="compact-stat"><div><p>Returns reported, gate unverified</p><strong>{returns}</strong></div></article>
  </section>
  <section className="policy-banner mt-5"><div>
    <strong>Important: absence of a report is not evidence that a student is on site.</strong>
    <p>An OUT update is the student's stated intention. An overdue return does not prove
       disappearance or an emergency. A late notice does not automatically grant access
       after hostel operating hours. Security must arrange coverage directly and verify
       every actual arrival before recording gate return.</p>
    <SafetyQueueRefresh/>
  </div></section>
  <DeviceReminderOptIn audience="staff"/>
  <form method="get" className="panel entity-form mt-5">
    <label className="field-group"><span>Hostel property</span>
      <select name="property" defaultValue={propertyId??""}>
        <option value="">All authorized properties</option>
        {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
    <button className="secondary-button">Filter security queue</button>
  </form>
  {current.length?current.slice(0,30).map(item=>{
    const property=byProperty.get(item.propertyId);
    const currentStatus=outingAttention(item,now);
    const contact=registeredResidentCallTarget(item.student.phone,property?.countryCode,organizationId);
    const format=(v:Date)=>v.toLocaleString("en-KE",{
      timeZone:hostelTimeZone(property?.timeZone,property?.countryCode),
      dateStyle:"medium",timeStyle:"short",
    });
    return <section className="panel entity-form mt-5" key={item.id}>
      <h2>{item.student.fullName} — {item.status==="OUT"?"Reported out":"Return self-reported"}</h2>
      <p>{property?.name??"Hostel"} · Room {item.roomLabel}
        · Left reported {format(item.leftAt)}
        · Expected return {format(item.expectedReturnAt)}</p>
      {currentStatus.overdueUnconfirmed?<p className="form-error">
        Return time passed and actual return remains unconfirmed. Contact the student;
        do not mark them missing solely because of this timestamp.</p>:null}
      {item.lateNotifiedAt?<p>
        <strong>Student late notice:</strong> {format(item.lateNotifiedAt)}
        {item.lateMessage?" · "+item.lateMessage:""}
        {item.lateAcknowledgedAt?" · Staff noted this notice":" · Needs security review"}.
        Any extension needs staffing confirmation, not just a form submission.
      </p>:null}
      {item.studentReturnedAt?<p><strong>Return self-reported:</strong> {format(item.studentReturnedAt)}.
         Actual gate entry awaits your verification.</p>:null}
      {contact?<p><a href={contact.href} className="secondary-button">
          Call registered mobile {contact.display}</a></p>:
        <p className="muted-note">Registered mobile cannot be safely dialed; verify contact through authorized records.</p>}
      <StaffOutingControls id={item.id} status={item.status}
        lateNotifiedAt={item.lateNotifiedAt!==null}
        lateAcknowledgedAt={item.lateAcknowledgedAt!==null}/>
    </section>;
  }):<section className="panel mt-5">
    <h2>No open student outings reported</h2>
    <p>This does not prove that every resident is at the hostel.</p>
  </section>}
  <nav className="heading-actions mt-5" aria-label="Outing queue pages">
    {page>1?<Link href={link(page-1)}>Previous</Link>:null}
    {current.length>30?<Link href={link(page+1)}>Next</Link>:null}
  </nav>
 </div>;
}
