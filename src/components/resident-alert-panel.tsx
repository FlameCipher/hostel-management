"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCheck, CircleAlert, RefreshCw } from "lucide-react";
import type { ResidentAlertSummary } from "@/lib/resident-alerts";
import styles from "./resident-alert-panel.module.css";

export function ResidentAlertPanel({ tenant = false }: { tenant?: boolean }) {
  const [data, setData] = useState<ResidentAlertSummary | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const pending = useRef(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (pending.current) return;
    pending.current = true;
    setRefreshing(true);
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    try {
      const response = await fetch(`/api/resident-alerts?audience=${tenant ? "tenant" : "staff"}`, { cache: "no-store", signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Live alerts unavailable.");
      if (!signal?.aborted) { setData(result); setError(""); }
    } catch (e) {
      if (!signal?.aborted) { setData(null); setError(timedOut ? "The connection is taking too long." : e instanceof Error ? e.message : "Live alerts unavailable."); }
    } finally { clearTimeout(timeout); signal?.removeEventListener("abort", cancel); pending.current = false; if (!signal?.aborted) setRefreshing(false); }
  }, [tenant]);
  useEffect(() => {
    const controller = new AbortController();
    const first = setTimeout(() => void refresh(controller.signal), 0);
    const timer = setInterval(() => { if (!document.hidden) void refresh(controller.signal); }, 60000);
    return () => { controller.abort(); clearTimeout(first); clearInterval(timer); };
  }, [refresh]);
  const total = data ? data.overdueCount + data.pendingVisits + (data.awaitingManagement ?? 0) + (data.pendingRegistrations ?? 0) + (data.unreadMessages ?? 0) : null;
  const items = data ? [
    { value: data.overdueCount, label: "Overdue check-outs", accessible: "check-out overdue", href: tenant ? "/tenant/visitors" : "/visitors?filter=OVERDUE", warning: true },
    { value: data.pendingVisits, label: "Visitor requests", accessible: "visitor requests", href: tenant ? "/tenant/visitors" : "/visitors" },
    { value: data.awaitingManagement, label: "Inbox to reply", accessible: "conversations awaiting management", href: "/communications/inbox" },
    { value: data.pendingRegistrations, label: "Accounts to verify", accessible: "registrations to verify", href: "/students/registrations" },
    { value: data.unreadMessages, label: "Unread notices", accessible: "unread notices", href: "/tenant/messages" },
  ].filter(item => item.value !== null) : [];
  return <section className={styles.panel} aria-label="Live resident alerts" aria-busy={refreshing}>
    <header className={styles.header}><span className={`${styles.statusIcon} ${total ? styles.needsAction : total === 0 ? styles.clear : ""}`}>{total === 0 ? <CheckCheck aria-hidden="true" size={19}/> : <CircleAlert aria-hidden="true" size={19}/>}</span><div aria-live="polite"><h2 className={styles.title}>{total ? "Follow-up needed" : "Resident activity"}</h2><p className={styles.subtitle}>{total === null ? "Your latest hostel activity" : total === 0 ? "No pending resident alerts" : `${total} ${total === 1 ? "item needs" : "items need"} your attention`}</p></div><button type="button" className={styles.refresh} title="Refresh alerts" aria-label="Refresh alerts" disabled={refreshing} onClick={() => void refresh()}><RefreshCw aria-hidden="true" size={17} className={refreshing ? styles.spinning : undefined}/></button></header>
    {error ? <p role="alert" className={styles.error}>{error} Use refresh to try again.</p> : data ? <>
      <div className={styles.tiles}>{items.map(item => <Link key={item.href + item.label} href={item.href} aria-label={`${item.value} ${item.accessible}`} className={`${styles.tile} ${item.warning && item.value ? styles.overdue : ""}`}><span>{item.label}<ArrowUpRight aria-hidden="true" size={13}/></span><strong>{item.value}</strong></Link>)}</div>
      {data.overdue.length > 0 && <details className={styles.records}><summary>Review overdue visits <span>{data.overdueCount}</span></summary><p className={styles.explanation}>Departure has not been recorded. Confirm with the host or gate team; this does not prove the visitor is still inside.</p>{data.overdue.map(v => <article key={v.id}><strong>{v.visitorName}</strong><span>Host: {v.host} · Room {v.room}</span><p>Expected departure: {new Date(v.expectedDeparture).toLocaleString("en-GB", { timeZone: v.timeZone })} ({v.timeZone})</p></article>)}{data.overdueCount > 10 && <p>Showing the oldest 10. Open the visitor register for all overdue records.</p>}</details>}
      <footer className={styles.footer}><span className={styles.updated}><span aria-hidden="true"/>Updated {new Date(data.observedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span><span>Auto-refresh · 1 min</span></footer>
    </> : <p className={styles.loading} role="status">Loading current records…</p>}
  </section>;
}
