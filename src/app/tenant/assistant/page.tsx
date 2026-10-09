import Link from "next/link";
import { WhatsAppPreferences } from "@/components/whatsapp-preferences";
import { PushSettings } from "@/components/push-settings";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { ResidentAlertPanel } from "@/components/resident-alert-panel";
import { SystemAssistant } from "@/components/system-assistant";
import styles from "@/components/resident-services.module.css";
export const dynamic = "force-dynamic";
export default async function TenantAssistant() {
 await requireTenantSession();
 return <main className={`marketing-section ${styles.page}`}><div className="page-heading-row"><h1>My system assistant</h1><Link className="secondary-button" href="/tenant/account">My account</Link></div><PushSettings tenant/><WhatsAppPreferences tenant/><ResidentAlertPanel tenant/><SystemAssistant role="TENANT"/></main>;
}
