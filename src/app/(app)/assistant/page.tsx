import { requireSession } from "@/lib/auth/session";
import { residentStaff } from "@/lib/resident-access";
import { db } from "@/lib/db";
import Link from "next/link";
import { ResidentAlertPanel } from "@/components/resident-alert-panel";
import { SystemAssistant } from "@/components/system-assistant";
import styles from "@/components/resident-services.module.css";
import type { AssistantWorkspaceData } from "@/components/assistant-action-workspace";
import { minorUnits } from "@/lib/currency";
export const dynamic = "force-dynamic";
export default async function AssistantPage() {
 const session = await requireSession(), staff = await residentStaff(db, session);
 if (!staff) return <p>Assistant unavailable. Sign in again.</p>;
 const workspace: AssistantWorkspaceData | undefined = staff.role==="CARETAKER" ? undefined : await (async () => {
   const organizationId=session.organizationId;
   const [organization, roomTypes, semesters, charges]=await Promise.all([
     db.organization.findUniqueOrThrow({where:{id:organizationId},select:{currency:true}}),
     db.roomType.findMany({where:{organizationId,active:true},select:{id:true,name:true,currency:true,semesterRate:true},orderBy:{name:"asc"}}),
     db.semester.findMany({where:{organizationId,status:"ACTIVE"},select:{id:true,name:true},orderBy:{startDate:"desc"},take:20}),
     db.charge.findMany({where:{organizationId,status:{not:"WAIVED"}},select:{
       id:true,currency:true,amount:true,
       student:{select:{fullName:true,occupancies:{where:{organizationId,status:"ACTIVE"},select:{room:{select:{number:true}}},take:2}}},
       semester:{select:{name:true}},payments:{where:{reversedAt:null},select:{amount:true}}
     },orderBy:{dueDate:"asc"},take:1000}),
   ]);
   const currency=organization.currency, factor=minorUnits(1,currency);
   return {
     currency,
     roomTypes:roomTypes.filter(r=>r.currency===currency).map(r=>({id:r.id,label:r.name,semesterRate:Number(r.semesterRate)})),
     semesters:semesters.map(s=>({id:s.id,label:s.name})),
     charges:charges.filter(c=>c.currency===currency).map(c=>{
       const balanceMinor=minorUnits(Number(c.amount),currency)-c.payments.reduce((total,p)=>total+minorUnits(Number(p.amount),currency),0);
       const numbers=[...new Set(c.student.occupancies.map(o=>o.room.number))];
       return {id:c.id,studentName:c.student.fullName,roomNumber:numbers.length===1?numbers[0]:null,period:c.semester?.name??"Other charge",balance:balanceMinor/factor,currency};
     }).filter(c=>c.balance>0),
   };
 })();

 return <div className={styles.page}><div><p className="eyebrow">Guidance & live records</p><h1>System assistant</h1><p>Help for {staff.role === "CARETAKER" ? "caretaker / security" : "management"}, scoped to your hostel.</p></div><ResidentAlertPanel/><section className="panel" style={{padding:18,marginBottom:16}}><h2>AI Management Desk</h2><p>{staff.role==="CARETAKER"?"Check expected visitor registrations, verify host rooms and report unrecorded departures. The assistant cannot grant admission or edit financial records.":"Ask about hostel operations, then review actual records before making changes. Financial transactions and mass messages require authorization."}</p><div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:12}}>
  {staff.role==="CARETAKER"?<>
    <Link className="secondary-button no-underline" href="/visitors?filter=EXPECTED">Expected visitors</Link>
    <Link className="secondary-button no-underline" href="/visitors?filter=OVERDUE">Departure not verified</Link>
    <Link className="secondary-button no-underline" href="/rooms">Room availability</Link>
  </>:<>
    <Link className="secondary-button no-underline" href="/payments?view=outstanding">Review unpaid charges</Link>
    <Link className="secondary-button no-underline" href="/communications">Prepare student notice</Link>
    <Link className="secondary-button no-underline" href="/gate-readiness">Gate readiness</Link>
  </>}
</div></section><SystemAssistant role={staff.role === "CARETAKER" ? "CARETAKER" : "MANAGEMENT"} workspace={workspace}/></div>;
}
