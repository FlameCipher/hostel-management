import { requireSession } from "@/lib/auth/session";
import { residentStaff } from "@/lib/resident-access";
import { db } from "@/lib/db";
import Link from "next/link";
import { ResidentAlertPanel } from "@/components/resident-alert-panel";
import { SystemAssistant } from "@/components/system-assistant";
import styles from "@/components/resident-services.module.css";
export const dynamic = "force-dynamic";
export default async function AssistantPage() {
 const session = await requireSession(), staff = await residentStaff(db, session);
 if (!staff) return <p>Assistant unavailable. Sign in again.</p>;
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
</div></section><SystemAssistant role={staff.role === "CARETAKER" ? "CARETAKER" : "MANAGEMENT"}/></div>;
}
