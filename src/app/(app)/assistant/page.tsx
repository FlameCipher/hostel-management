import { requireSession } from "@/lib/auth/session";
import { residentStaff } from "@/lib/resident-access";
import { db } from "@/lib/db";
import { ResidentAlertPanel } from "@/components/resident-alert-panel";
import { SystemAssistant } from "@/components/system-assistant";
import styles from "@/components/resident-services.module.css";
export const dynamic = "force-dynamic";
export default async function AssistantPage() {
 const session = await requireSession(), staff = await residentStaff(db, session);
 if (!staff) return <p>Assistant unavailable. Sign in again.</p>;
 return <div className={styles.page}><div><p className="eyebrow">Guidance & live records</p><h1>System assistant</h1><p>Help for {staff.role === "CARETAKER" ? "caretaker / security" : "management"}, scoped to your hostel.</p></div><ResidentAlertPanel/><SystemAssistant role={staff.role === "CARETAKER" ? "CARETAKER" : "MANAGEMENT"}/></div>;
}
