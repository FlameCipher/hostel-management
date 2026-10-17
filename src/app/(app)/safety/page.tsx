import { HostelEmergencyCallLinks } from "@/components/hostel-emergency-call-links";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { residentStaff } from "@/lib/resident-access";
import { db } from "@/lib/db";
import { availableSOSLocation, sosPilotEnabled } from "@/lib/student-safety";
import { registeredResidentCallTarget } from "@/lib/tenant-verification-contact";
import { SafetyResponseForm } from "@/components/safety-response";
import { SafetyQueueRefresh } from "@/components/safety-queue-refresh";
import { DeviceReminderOptIn } from "@/components/device-reminder-optin";

export const dynamic="force-dynamic";
export const metadata={title:"Student SOS response",robots:{index:false,follow:false}};

export default async function StaffSafetyPage(){
 const session=await requireSession();
 const staff=await residentStaff(db,session);
 if(!staff)return <section className="panel"><h1>Safety alerts unavailable</h1>
   <p>Sign in with an active hostel staff account.</p></section>;
 const organizationId=session.organizationId,now=new Date();
 const [open,history,properties,count]=await Promise.all([
   db.safetyAlert.findMany({
     where:{organizationId,status:{in:["OPEN","ACKNOWLEDGED"]}},
     orderBy:[{createdAt:"asc"},{id:"asc"}],take:51,
     select:{id:true,propertyId:true,roomLabel:true,status:true,note:true,
       latitude:true,longitude:true,accuracyMeters:true,locationSharedAt:true,
       acknowledgedAt:true,createdAt:true,
       student:{select:{fullName:true,phone:true}}}
   }),
   db.safetyAlert.findMany({
     where:{organizationId,status:"CLOSED"},
     orderBy:{createdAt:"desc"},take:10,
     select:{id:true,createdAt:true,closedAt:true,roomLabel:true,
       student:{select:{fullName:true}}}
   }),
   db.property.findMany({where:{organizationId},select:{id:true,name:true,countryCode:true}}),
   db.safetyAlert.count({where:{organizationId,status:{in:["OPEN","ACKNOWLEDGED"]}}}),
 ]);
 const props=new Map(properties.map(p=>[p.id,p]));
 const canClose=["OWNER","ADMIN"].includes(staff.role);
 return <div>
   <div className="page-heading-row"><div>
     <p className="eyebrow">Hostel staff · Student safety</p>
     <h1>Student danger / SOS alerts</h1>
     <p><strong>{count} open or acknowledged SOS request{count===1?"":"s"}.</strong>
       Recorded incidents require actual human response and urgent action when needed.</p>
   </div><Link href="/visitors" className="secondary-button">Visitor gate</Link></div>
   <HostelEmergencyCallLinks organizationId={organizationId}/>
   {!sosPilotEnabled(session.organizationId)?<section className="panel entity-form mt-5">
     <h2>SOS pilot not yet activated</h2>
     <p>Incident submission is disabled until an authorized responder is appointed,
       the phone test is completed, and the hostel has a reliable response process.
       Students can still use national emergency phone numbers.</p>
     <Link href="/gate-readiness" className="secondary-button">Review staffed gate readiness</Link>
   </section>:null}
   <section className="policy-banner mt-5"><div>
     <strong>SOS is not automated rescue or police dispatch.</strong>
     <p>Call the student on the phone already in the hostel register, organize real help and
       contact police at <a href="tel:999">999</a> or <a href="tel:112">112</a> for immediate danger.
       A response is only acknowledged after staff document a real action.</p>
     <SafetyQueueRefresh/>
   </div></section>
   <DeviceReminderOptIn audience="staff"/>
   {count>50?<p className="form-error">More than 50 SOS alerts are active. This page shows the oldest 50 first. Review the backlog immediately.</p>:null}
   {open.length?open.slice(0,50).map(alert=>{
     const property=props.get(alert.propertyId);
     const phone=registeredResidentCallTarget(alert.student.phone,property?.countryCode,organizationId);
     const location=availableSOSLocation(alert,now);
     return <section className="panel entity-form mt-5" key={alert.id}>
       <h2>{alert.status==="OPEN"?"SOS — awaiting staff response":"SOS — staff acknowledged"} · {alert.student.fullName}</h2>
       <p><strong>{property?.name??"Hostel"}</strong> · Room {alert.roomLabel}
         · Submitted {alert.createdAt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})}</p>
       {alert.status==="OPEN"&&now.getTime()-alert.createdAt.getTime()>=5*60000?
         <p className="form-error" role="alert">Unacknowledged for at least five minutes. Call the student and the designated on-call responder directly; do not wait for app notifications. A push-provider receipt does not establish delivery, reading or physical response.</p>:null}
       {alert.note?<p>Student's optional message: {alert.note}</p>:null}
       {phone?<p><a className="primary-button" href={phone.href}>Call registered student {phone.display}</a></p>:
         <p className="form-error">No validated registered student contact. Independently verify before using another number.</p>}
       {location?<p><strong>Student shared a one-time location.</strong>
         <a href={location.mapUrl} target="_blank" rel="noopener noreferrer" className="secondary-button">
           Open location in map
         </a> Captured {location.recordedAt.toLocaleTimeString("en-KE",{timeZone:"Africa/Nairobi"})}
         {location.accuracyMeters!==null?` · reported accuracy approximately ${Math.round(location.accuracyMeters)} metres`:""}.
         Opening the map shares coordinates with the map provider. Location is not continuous or guaranteed current.</p>:
         <p className="muted-note">No usable current location shared for this incident. Do not infer the student's whereabouts.</p>}
       {alert.acknowledgedAt?<p>Staff acknowledgement recorded {alert.acknowledgedAt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})}; not proof of on-site help.</p>:null}
       <SafetyResponseForm id={alert.id} status={alert.status} canClose={canClose}/>
     </section>;
   }):<section className="panel mt-5"><h2>No active SOS records</h2>
     <p>There are no open student SOS records currently in this hostel register.
        This does not prove that every student is safe or being tracked.</p></section>}
   <section className="panel entity-form mt-5"><h2>Recent closed incident records</h2>
     {history.length?history.map(item=><p key={item.id}>
       {item.student.fullName} · Room {item.roomLabel}
       · {item.closedAt?.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})??"Closure not confirmed"}
     </p>):<p>No closed incidents recorded.</p>}
     <p className="muted-note">Precise location is removed when the incident record is closed. Staff case notes remain subject to hostel safety and data protection controls.</p>
   </section>
 </div>;
}
