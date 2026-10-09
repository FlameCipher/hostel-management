import Link from "next/link";
import { SystemAssistant } from "@/components/system-assistant";
import styles from "@/components/resident-services.module.css";
export default function HelpPage() { return <main className={`marketing-section ${styles.page}`}><h1>How the hostel system works</h1><p>Get help with your tenant account, private messages and visitor requests. Sign in for your own records and alerts.</p><SystemAssistant role="PUBLIC"/><nav className={styles.actions}><Link className="primary-button" href="/tenant/login">Tenant sign in</Link><Link className="secondary-button" href="/login">Management sign in</Link><Link href="/install">Install hostel app</Link><Link href="/">Hostel website</Link></nav></main>; }
