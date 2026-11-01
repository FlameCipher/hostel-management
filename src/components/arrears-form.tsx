"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Send, MessageCircle, ChevronDown } from "lucide-react";
import { sendArrearsAction, forwardArrearsAction, arrearsAutomationAction } from "@/app/(app)/reports/arrears/actions";
import type { ArrearsRow } from "@/lib/arrears-reminders";
import styles from "./arrears-form.module.css";

type Row = ArrearsRow & { delivery: string };
export function ArrearsForm({ rows, requestId, whatsappEnabled, businessReady, emailReady }: { rows: Row[]; requestId: string; whatsappEnabled: boolean; businessReady: boolean; emailReady: boolean }) {
  const [selected, setSelected] = useState<string[]>([]), [query, setQuery] = useState("");
  const [state, action, pending] = useActionState(sendArrearsAction, {});
  const chosen = rows.filter(row => selected.includes(row.studentId));
  const visible = rows.filter(row => `${row.name} ${row.room} ${row.phone}`.toLowerCase().includes(query.toLowerCase().trim()));
  const toggle = (id: string) => setSelected(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
  return <form action={action} className={styles.form}>
    <input type="hidden" name="requestId" value={requestId}/>
    <input type="hidden" name="recipients" value={JSON.stringify(chosen.map(row => ({ studentId: row.studentId, fingerprint: row.fingerprint })))}/>
    <div className={styles.toolbar}><label className={styles.search}>Find a tenant<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, room or phone"/></label><div className={styles.selection}><button type="button" onClick={() => setSelected([...new Set([...selected, ...visible.slice(0, 500).map(row => row.studentId)])].slice(0, 500))}>Select all shown</button><button type="button" onClick={() => setSelected([])}>Clear</button></div></div>
    {chosen.length > 0 ? <div className={styles.sendBox}><strong>{chosen.length} tenant{chosen.length === 1 ? "" : "s"} selected</strong><span>Each tenant receives only their own balance and account link.</span><div className={styles.channels}><label><input type="checkbox" name="whatsapp" defaultChecked={whatsappEnabled} disabled={!whatsappEnabled}/>WhatsApp copy</label><label><input type="checkbox" name="email" disabled={!emailReady}/>Email copy{!emailReady ? " (not connected)" : ""}</label></div><p>{businessReady ? "WhatsApp sends automatically to tenants who have opted in. Other copies are ready to forward." : "WhatsApp copies are ready to forward."} Private notices are also saved to tenant accounts. {!businessReady && <Link href="/communications/whatsapp">Set up automatic WhatsApp</Link>}</p><button className={styles.primary} disabled={!chosen.length || pending}><Send size={17} aria-hidden="true"/>{pending ? "Preparing requests…" : `Prepare payment demands (${chosen.length})`}</button></div> : rows.length > 0 ? <p className={styles.note}>Select tenants for a group request, or tap WhatsApp beside a tenant.</p> : null}
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p className={styles.success} role="status">{state.success} <Link href="/communications/whatsapp">View WhatsApp queue</Link></p>}
    <div className={styles.list}>{visible.map(row => <article className={styles.tenant} key={row.studentId}>
      <label className={styles.tenantHeader}><input type="checkbox" checked={selected.includes(row.studentId)} onChange={() => toggle(row.studentId)} disabled={pending || (!selected.includes(row.studentId) && selected.length >= 500)}/><span><strong>{row.name}</strong><small>Room {row.room || "—"} · Due {row.due}</small></span><strong className={styles.amount}>{row.balance}</strong></label>
      <div className={styles.tenantFooter}><span>{row.lastAt ? `${new Date(row.lastAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ` : ""}{row.delivery}{row.lastEmailStatus && row.lastEmailStatus !== "NOT_REQUESTED" ? ` · Email: ${row.lastEmailStatus.replaceAll("_", " ").toLowerCase()}` : ""}{!row.portalReady ? " · Portal not activated" : ""}</span><button type="submit" formAction={forwardArrearsAction.bind(null, row.studentId, row.fingerprint, requestId)} disabled={!row.phone || !whatsappEnabled || pending}><MessageCircle size={16} aria-hidden="true"/>WhatsApp</button></div>
      {!row.phone && <p className={styles.note}>Add a valid tenant phone number to forward on WhatsApp.</p>}
      <details><summary>Preview payment demand<ChevronDown size={16} aria-hidden="true"/></summary><p className={styles.preview}>{row.message}</p><Link href={`/students/${row.studentId}`}>Open tenant account</Link> · <Link href={`/reports/arrears?agreement=${encodeURIComponent(row.studentId)}`}>Agree a different payment date</Link></details>
    </article>)}</div>
    {!visible.length && <p className={styles.empty}>{rows.length ? "No matching tenants." : "No overdue balances for current tenants."}</p>}
  </form>;
}
export function ArrearsAutomationForm({ enabled, whatsapp, email, whatsappEnabled, emailReady }: { enabled: boolean; whatsapp: boolean; email: boolean; whatsappEnabled: boolean; emailReady: boolean }) {
  const [state, action, pending] = useActionState(arrearsAutomationAction, {});
  return <details className={styles.automation}><summary>Automatic follow-ups <span>{enabled ? "On" : "Off"}</span><ChevronDown size={18} aria-hidden="true"/></summary><form action={action}><label><input name="enabled" type="checkbox" defaultChecked={enabled}/>Automatically request overdue payments</label><p>Checked daily at 8 a.m. Nairobi time. One request per tenant every 7 days while overdue. Cleared balances and approved payment extensions are skipped, and queued copies are checked again before sending.</p><label><input name="whatsapp" type="checkbox" defaultChecked={whatsapp} disabled={!whatsappEnabled}/>WhatsApp copies</label><label><input name="email" type="checkbox" defaultChecked={email} disabled={!emailReady}/>Email copies{!emailReady ? " (not connected)" : ""}</label><button className={styles.primary} disabled={pending}>{pending ? "Saving…" : "Save automatic reminders"}</button>{state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p className={styles.success} role="status">{state.success}</p>}</form></details>;
}
