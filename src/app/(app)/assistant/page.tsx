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
 return <div className={styles.page}><div><p className="eyebrow">Guidance & live records</p><h1>System assistant</h1><p>Help for {staff.role === "CARETAKER" ? "caretaker / security" : "management"}, scoped to your hostel.</p></div><ResidentAlertPanel/><section className="panel" style={{padding:18,marginBottom:16}}><h2>AI Management Desk</h2><p>Ask about hostel operations, then review the actual records before making changes. Financial transactions and mass messages require your authorization.</p><div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:12}}><Link className="secondary-button no-underline" href="/payments">Review unpaid charges</Link><Link className="secondary-button no-underline" href="/communications">Prepare student notice</Link><Link className="secondary-button no-underline" href="/rooms">Review room availability</Link></div></section><SystemAssistant role={staff.role === "CARETAKER" ? "CARETAKER" : "MANAGEMENT"}/></div>;
}
