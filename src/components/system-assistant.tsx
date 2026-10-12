"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { searchSystemGuide, systemGuide, type GuideRole } from "@/lib/system-guide";
import { receiptQueueNavigationRequest } from "@/lib/receipt-queue-intents";
import { financialAuditNavigationRequest } from "@/lib/financial-audit-intents";
import { transferReviewNavigationRequest } from "@/lib/room-transfer-review-intents";
import styles from "./resident-services.module.css";
export function SystemAssistant({ role }: { role: GuideRole }) {
  const router = useRouter();
  const [question, setQuestion] = useState(""), [submitted, setSubmitted] = useState("");
  const [answer,setAnswer]=useState(""),[mode,setMode]=useState(""),[links,setLinks]=useState<{title:string;href:string;action:string}[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function ask(value:string){
    if(!value.trim()||busy)return;
    if(role==="MANAGEMENT" && transferReviewNavigationRequest(value)){
      router.push("/occupancy/transfers");
      return;
    }
    if(role==="MANAGEMENT" && financialAuditNavigationRequest(value)){
      router.push("/payments/audit");
      return;
    }
    if(role==="MANAGEMENT" && receiptQueueNavigationRequest(value)){
      router.push("/payments?delivery=all");
      return;
    }
    if (role === "MANAGEMENT" && /^(?:find|locate|search(?: for)?|open|show|where is)\b/i.test(value.trim()) &&
        !/\b(?:unpaid|outstanding|owe|owing|not paid|balance|deni|madeni)\b/i.test(value)) {
      const room = value.match(/\broom\s*(?:number\s*)?(\d+[a-z]?)\b/i);
      const subject = room?.[1] ?? value.trim()
        .replace(/^(?:find|locate|search(?: for)?|open|show|where is)\s+(?:(?:me\s+)?(?:student|resident|tenant|room)(?:\s+number)?\s+)?/i, "")
        .replace(/[.!?]+$/, "").trim();
      if (subject.length >= 2 && subject.length <= 80) {
        router.push("/occupancy?q=" + encodeURIComponent(subject));
        return;
      }
    }
    setSubmitted(value);setBusy(true);setError("");setAnswer("");setLinks([]);
    try{const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:value,audience:role==="TENANT"?"tenant":"staff"}),signal:AbortSignal.timeout(35000)});const result=await response.json();if(!response.ok)throw Error(result.error||"The assistant could not respond.");setAnswer(result.text);setMode(result.mode);setLinks(Array.isArray(result.links)?result.links.filter((l:unknown)=>!!l&&typeof l==="object"&&typeof (l as {href?:string}).href==="string"&&((l as {href:string}).href.startsWith("/")&&!((l as {href:string}).href.startsWith("//")))).slice(0,5):[]);}catch(e){setError(e instanceof Error?e.message:"The assistant could not respond. Use the guide below.");}finally{setBusy(false);}
  }
  const topics = systemGuide(role), matches = searchSystemGuide(topics, submitted);
  return <section className={`panel ${styles.card}`}><h2>How can I help?</h2><p>Ask about visitors, messages, registration, accounts or staff access. You can ask in your preferred language.</p><p className={styles.meta}>AI answers use the system guide and permitted live summaries. Questions are processed by the AI provider; do not include passwords, codes or sensitive personal details. Read-only finance questions return verified live summaries. For registration and payments, the assistant opens secured forms; it does not post transactions or send messages without authorization.</p><form onSubmit={e => { e.preventDefault(); void ask(question); }}><label className="field-group"><span>Your question</span><input maxLength={1200} value={question} onChange={e => setQuestion(e.target.value)} placeholder={role==="MANAGEMENT"?"Who hasn’t paid this semester?":"Who has not checked out?"} required/></label><button className="primary-button" disabled={busy}>{busy?"Thinking…":"Ask assistant"}</button></form><div className={styles.actions}>{(role==="MANAGEMENT"?["Who hasn’t paid?", "Register a student", "Record payment"]:["Register an account", "Message management", "Visitor check-out"]).map(q => <button key={q} className="secondary-button" disabled={busy} onClick={() => { setQuestion(q); void ask(q); }}>{q}</button>)}</div>{error&&<p role="alert">{error}</p>}{answer&&<article className={styles.entry} aria-live="polite"><h3>{mode==="ai"?"Assistant answer":mode==="records"?"Live financial records":mode==="workflow"?"Review the secure workflow":"System guidance"}</h3><p style={{whiteSpace:"pre-wrap"}}>{answer}</p>{links.length>0&&<div className={styles.actions}>{links.map(l=><Link key={l.href} className="secondary-button" href={l.href}>{l.action}</Link>)}</div>}{mode==="ai"&&<small>AI can make mistakes. Confirm important details in the linked records.</small>}</article>}<div><h3>Documented steps</h3>{matches.length ? matches.map(topic => <article className={styles.entry} key={topic.title}><h3>{topic.title}</h3><p>{topic.body}</p><Link href={topic.href}>{topic.action}</Link></article>) : <p>I do not have documented guidance for that question. Try visitors, messages, registration or accounts, or contact hostel management.</p>}</div></section>;
}
