import { requireSession } from "@/lib/auth/session";
import { residentStaff } from "@/lib/resident-access";
import { db } from "@/lib/db";
import Link from "next/link";
import { formatMoney, roundCurrency } from "@/lib/currency";
import { managementCurrency } from "@/lib/organization-currency";
import { ResidentAlertPanel } from "@/components/resident-alert-panel";
import { SystemAssistant } from "@/components/system-assistant";
import styles from "@/components/resident-services.module.css";
export const dynamic = "force-dynamic";
export default async function AssistantPage() {
 const session = await requireSession(), staff = await residentStaff(db, session);
 if (!staff) return <p>Assistant unavailable. Sign in again.</p>;
 const canSeeFinance = ["OWNER", "ADMIN", "MANAGER"].includes(staff.role);
 const currency = canSeeFinance ? await managementCurrency() : null;
 const unpaid = canSeeFinance ? await db.charge.findMany({where:{organizationId:session.organizationId,status:{notIn:["FULLY_PAID","WAIVED"]}},select:{id:true,amount:true,currency:true,student:{select:{fullName:true}},payments:{where:{reversedAt:null},select:{amount:true}}},orderBy:{dueDate:"asc"},take:500}) : [];
 const outstanding = unpaid.map(charge=>({...charge,balance:Math.max(0,roundCurrency(Number(charge.amount)-charge.payments.reduce((sum,p)=>sum+Number(p.amount),0),charge.currency))})).filter(charge=>charge.balance>0);
 return <div className={styles.page}><div><p className="eyebrow">Guidance & live records</p><h1>System assistant</h1><p>Help for {staff.role === "CARETAKER" ? "caretaker / security" : "management"}, scoped to your hostel.</p></div><ResidentAlertPanel/><section className="panel" style={{padding:18,marginBottom:16}}><h2>AI Management Desk</h2><p>Ask about hostel operations, then review the actual records before making changes. Financial transactions and mass messages require your authorization.</p><div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:12}}><Link className="secondary-button no-underline" href="/payments">Review unpaid charges</Link><Link className="secondary-button no-underline" href="/communications">Prepare student notice</Link><Link className="secondary-button no-underline" href="/rooms">Review room availability</Link></div></section>{canSeeFinance ? <section className="panel" style={{padding:18,marginBottom:16}}><h2>Outstanding rent and charges</h2><p>Live read-only summary of up to 500 unsettled charges for this hostel. No payments are created by this report.</p><p><strong>{outstanding.length} outstanding charges</strong> · {currency ? formatMoney(outstanding.reduce((sum,c)=>sum+c.balance,0),currency) : ""} total</p><div style={{maxHeight:300,overflowY:"auto"}}>{outstanding.slice(0,30).map(charge=><div key={charge.id} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"10px 0",borderBottom:"1px solid #e4e9f0"}}><span>{charge.student.fullName}</span><strong>{formatMoney(charge.balance,charge.currency)}</strong></div>)}</div>{outstanding.length>30?<p>Showing first 30 charges. Open Payments for the full register.</p>:null}<Link href="/payments" className="text-link">Open payments and record details</Link></section> : null}<SystemAssistant role={staff.role === "CARETAKER" ? "CARETAKER" : "MANAGEMENT"}/></div>;
}
