"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bot, SendHorizontal, ShieldCheck, Sparkles } from "lucide-react";
import { searchSystemGuide, systemGuide, type GuideRole } from "@/lib/system-guide";
import { receiptQueueNavigationRequest } from "@/lib/receipt-queue-intents";
import { financialAuditNavigationRequest } from "@/lib/financial-audit-intents";
import { transferReviewNavigationRequest } from "@/lib/room-transfer-review-intents";
import { occupancySearchShortcut } from "@/lib/assistant-search-policy";
import { AssistantActionWorkspace, type AssistantWorkspaceData } from "@/components/assistant-action-workspace";
import styles from "./assistant-chat.module.css";

type ChatLink = { title:string; href:string; action:string };
type Message = { id:number; role:"user"|"assistant"; text:string; mode?:string; links?:ChatLink[] };
const safeLink = (candidate:unknown):candidate is ChatLink => {
  if(!candidate||typeof candidate!=="object")return false;
  const value=candidate as Partial<ChatLink>;
  return typeof value.action==="string"&&typeof value.title==="string"&&typeof value.href==="string"
    &&value.href.startsWith("/")&&!value.href.startsWith("//")&&!value.href.includes("\\");
};

export function SystemAssistant({role,workspace}:{role:GuideRole;workspace?:AssistantWorkspaceData}) {
  const router=useRouter();
  const [question,setQuestion]=useState("");
  const [submitted,setSubmitted]=useState("");
  const [messages,setMessages]=useState<Message[]>([]);
  const [busy,setBusy]=useState(false);
  const [workflow,setWorkflow]=useState<"register"|"payment"|null>(null);
  const id=useRef(0);
  const bottom=useRef<HTMLDivElement>(null);
  const suggestions=role==="MANAGEMENT"
    ? ["Who hasn't paid?","Room 41 payments","Register a student","Record payment"]
    : ["Who has not checked out?","How many visitors are expected?","Find room 41"];
  const guides=searchSystemGuide(systemGuide(role),submitted).slice(0,3);

  useEffect(()=>{if(messages.length) bottom.current?.scrollIntoView({behavior:"smooth",block:"nearest"});},[messages.length,busy]);

  async function ask(raw:string) {
    const value=raw.trim();
    if(!value||busy)return;
    if(role==="MANAGEMENT") {
      if(transferReviewNavigationRequest(value)){router.push("/occupancy/transfers");return;}
      if(financialAuditNavigationRequest(value)){router.push("/payments/audit");return;}
      if(receiptQueueNavigationRequest(value)){router.push("/payments?delivery=all");return;}
      const shortcut=occupancySearchShortcut(value);
      if(shortcut){router.push("/occupancy?q="+encodeURIComponent(shortcut));return;}
    }
    const requestId=++id.current;
    setMessages(items=>[...items.slice(-17),{id:requestId,role:"user",text:value}]);
    setQuestion("");
    setSubmitted(value);
    setBusy(true);
    setWorkflow(null);
    try {
      const response=await fetch("/api/assistant",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({question:value,audience:role==="TENANT"?"tenant":"staff"}),
        cache:"no-store",signal:AbortSignal.timeout(35000)
      });
      const result=await response.json();
      if(!response.ok)throw Error(typeof result.error==="string"?result.error:"The assistant could not respond.");
      const links=Array.isArray(result.links)?result.links.filter(safeLink).slice(0,4):[];
      const text=typeof result.text==="string"?result.text:"I could not verify an answer. Please try again.";
      setMessages(items=>[...items.slice(-17),{id:++id.current,role:"assistant",text,mode:result.mode,links}]);
      if(role==="MANAGEMENT"&&workspace&&(result.workflow==="register"||result.workflow==="payment"))setWorkflow(result.workflow);
    } catch(error) {
      const text=error instanceof Error?error.message:"Connection interrupted. Please try again.";
      setMessages(items=>[...items.slice(-17),{id:++id.current,role:"assistant",mode:"error",text}]);
    } finally {setBusy(false);}
  }

  return <section className={styles.shell} aria-label="MMAMBUGUA hostel system assistant">
    <header className={styles.header}>
      <span className={styles.avatar}><Bot size={23} aria-hidden="true"/></span>
      <div><h2>Hostel Assistant</h2><p>Your rooms, payments and operations — one conversation.</p></div>
      <span className={styles.status}><span className={styles.statusDot}/> Secure</span>
    </header>

    <div className={styles.conversation} role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions text">
      {messages.length===0 ? <div className={styles.welcome}>
        <span className={styles.welcomeIcon}><Sparkles size={24} aria-hidden="true"/></span>
        <h3>How can I help?</h3>
        <p>{role==="MANAGEMENT"
          ?"Ask about an individual room, who has paid, overdue balances, or ask me to prepare a transaction."
          :"Ask about rooms, expected visitors and gate records."}</p>
      </div> : messages.map(message=><article key={message.id} className={styles.message+" "+(message.role==="user"?styles.user:styles.assistant)}>
        <span className={styles.messageLabel}>{message.role==="user"?"You":message.mode==="records"?"Live hostel records":message.mode==="workflow"?"Action review":message.mode==="error"?"Connection issue":"Hostel Assistant"}</span>
        <div className={message.mode==="error"?styles.subtleError:styles.bubble}>{message.text}</div>
        {message.links?.length ? <div className={styles.messageLinks}>
          {message.links.map(link=><Link key={link.href+link.action} href={link.href}>{link.action}<ArrowUpRight size={13} aria-hidden="true"/></Link>)}
        </div> : null}
      </article>)}
      {busy && <div className={styles.message+" "+styles.assistant}>
        <span className={styles.messageLabel}>Checking hostel records…</span>
        <div className={styles.spinner} role="status" aria-label="Assistant responding"><span/><span/><span/></div>
      </div>}
      <div ref={bottom}/>
    </div>

    <div className={styles.quickActions} aria-label="Example questions">
      {suggestions.map(q=><button type="button" key={q} disabled={busy} onClick={()=>void ask(q)}>{q}</button>)}
    </div>
    <form className={styles.composer} onSubmit={event=>{event.preventDefault();void ask(question);}}>
      <div className={styles.composeRow}>
        <textarea aria-label="Ask your hostel assistant" rows={1} maxLength={1200} value={question}
          onChange={event=>setQuestion(event.target.value)}
          onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void ask(question);}}}
          placeholder="Ask anything about your hostel…" required />
        <button className={styles.send} type="submit" disabled={busy||!question.trim()} aria-label="Send question"><SendHorizontal size={20} aria-hidden="true"/></button>
      </div>
    </form>
    <p className={styles.helper}><ShieldCheck size={12} style={{verticalAlign:"-2px"}} aria-hidden="true"/> Live answers use permitted records. Financial changes require confirmation. Never enter passwords or PINs here.</p>
    {workflow&&workspace?<AssistantActionWorkspace key={workflow} kind={workflow} data={workspace} onClose={()=>setWorkflow(null)}/>:null}
    {submitted&&guides.length>0?<details className={styles.extras}>
      <summary>Related help and system instructions</summary>
      {guides.map(item=><div className={styles.guide} key={item.href+item.title}>
        <strong>{item.title}</strong><p>{item.body}</p><Link href={item.href}>{item.action}</Link>
      </div>)}
    </details>:null}
  </section>;
}
