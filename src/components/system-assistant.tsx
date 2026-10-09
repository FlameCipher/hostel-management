"use client";
import { useState } from "react";
import Link from "next/link";
import { searchSystemGuide, systemGuide, type GuideRole } from "@/lib/system-guide";
import styles from "./resident-services.module.css";
export function SystemAssistant({ role }: { role: GuideRole }) {
  const [question, setQuestion] = useState(""), [submitted, setSubmitted] = useState("");
  const [answer,setAnswer]=useState(""),[mode,setMode]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function ask(value:string){
    if(!value.trim()||busy)return;setSubmitted(value);setBusy(true);setError("");setAnswer("");
    try{const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:value,audience:role==="TENANT"?"tenant":"staff"}),signal:AbortSignal.timeout(35000)});const result=await response.json();if(!response.ok)throw Error(result.error||"The assistant could not respond.");setAnswer(result.text);setMode(result.mode);}catch(e){setError(e instanceof Error?e.message:"The assistant could not respond. Use the guide below.");}finally{setBusy(false);}
  }
  const topics = systemGuide(role), matches = searchSystemGuide(topics, submitted);
  return <section className={`panel ${styles.card}`}><h2>How can I help?</h2><p>Ask about visitors, messages, registration, accounts or staff access. You can ask in your preferred language.</p><p className={styles.meta}>AI answers use the system guide and permitted live summaries. Questions are processed by the AI provider; do not include passwords, codes or sensitive personal details. The assistant cannot change records or send messages.</p><form onSubmit={e => { e.preventDefault(); void ask(question); }}><label className="field-group"><span>Your question</span><input maxLength={1200} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Who has not checked out?" required/></label><button className="primary-button" disabled={busy}>{busy?"Thinking…":"Ask assistant"}</button></form><div className={styles.actions}>{["Register an account", "Message management", "Visitor check-out"].map(q => <button key={q} className="secondary-button" disabled={busy} onClick={() => { setQuestion(q); void ask(q); }}>{q}</button>)}</div>{error&&<p role="alert">{error}</p>}{answer&&<article className={styles.entry} aria-live="polite"><h3>{mode==="ai"?"Assistant answer":"System guidance"}</h3><p style={{whiteSpace:"pre-wrap"}}>{answer}</p>{mode==="ai"&&<small>AI can make mistakes. Confirm important details in the linked records.</small>}</article>}<div><h3>Documented steps</h3>{matches.length ? matches.map(topic => <article className={styles.entry} key={topic.title}><h3>{topic.title}</h3><p>{topic.body}</p><Link href={topic.href}>{topic.action}</Link></article>) : <p>I do not have documented guidance for that question. Try visitors, messages, registration or accounts, or contact hostel management.</p>}</div></section>;
}
