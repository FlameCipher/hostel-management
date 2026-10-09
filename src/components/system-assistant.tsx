"use client";
import { useState } from "react";
import Link from "next/link";
import { searchSystemGuide, systemGuide, type GuideRole } from "@/lib/system-guide";
import styles from "./resident-services.module.css";
export function SystemAssistant({ role }: { role: GuideRole }) {
  const [question, setQuestion] = useState(""), [submitted, setSubmitted] = useState("");
  const topics = systemGuide(role), matches = searchSystemGuide(topics, submitted);
  return <section className={`panel ${styles.card}`}><h2>How can I use the system?</h2><p>Ask about visitors, messages, registration, accounts or staff access.</p><p className={styles.meta}>This built-in guide uses documented workflows. Live alerts come from your permitted hostel records. Generative AI is not connected; the guide does not guess, send messages or change records.</p><form onSubmit={e => { e.preventDefault(); setSubmitted(question); }}><label className="field-group"><span>Your question</span><input maxLength={300} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Who has not checked out?"/></label><button className="primary-button">Show guidance</button></form><div className={styles.actions}>{["Register an account", "Message management", "Visitor check-out"].map(q => <button key={q} className="secondary-button" onClick={() => { setQuestion(q); setSubmitted(q); }}>{q}</button>)}</div><div aria-live="polite">{matches.length ? matches.map(topic => <article className={styles.entry} key={topic.title}><h3>{topic.title}</h3><p>{topic.body}</p><Link href={topic.href}>{topic.action}</Link></article>) : <p>I do not have documented guidance for that question. Try visitors, messages, registration or accounts, or contact hostel management.</p>}</div></section>;
}
