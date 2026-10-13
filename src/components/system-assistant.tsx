"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bot, SendHorizontal, ShieldCheck, Sparkles, Volume2, Pause, Play, Square, LoaderCircle } from "lucide-react";
import { searchSystemGuide, systemGuide, type GuideRole } from "@/lib/system-guide";
import { receiptQueueNavigationRequest } from "@/lib/receipt-queue-intents";
import { financialAuditNavigationRequest } from "@/lib/financial-audit-intents";
import { transferReviewNavigationRequest } from "@/lib/room-transfer-review-intents";
import { occupancySearchShortcut } from "@/lib/assistant-search-policy";
import { personSearchIntent, isPersonSearchFollowup } from "@/lib/assistant-person-intents";
import { AssistantActionWorkspace, type AssistantWorkspaceData } from "@/components/assistant-action-workspace";
import { AssistantAnnouncementReview } from "@/components/assistant-announcement-review";
import type { AnnouncementDraft } from "@/lib/assistant-announcement";
import { contextualBalanceFollowup } from "@/lib/assistant-report-intents";
import styles from "./assistant-chat.module.css";
import { useAssistantNarrator } from "./use-assistant-narrator";

type ChatLink = { title:string; href:string; action:string };
type Message = { id:number; role:"user"|"assistant"; text:string; mode?:string; links?:ChatLink[];voiceTicket?:string };
const safeLink = (candidate:unknown):candidate is ChatLink => {
  if(!candidate||typeof candidate!=="object")return false;
  const value=candidate as Partial<ChatLink>;
  return typeof value.action==="string"&&typeof value.title==="string"&&typeof value.href==="string"
    &&value.href.startsWith("/")&&!value.href.startsWith("//")&&!value.href.includes("\\");
};

export function SystemAssistant({role,workspace}:{role:GuideRole;workspace?:AssistantWorkspaceData}) {
  const router=useRouter();
  const narrator=useAssistantNarrator(role==="TENANT"?"tenant":"staff");
  const privateNarrationConfirmed=useRef<Set<number>>(new Set());
  const [question,setQuestion]=useState("");
  const [submitted,setSubmitted]=useState("");
  const [messages,setMessages]=useState<Message[]>([]);
  const [busy,setBusy]=useState(false);
  const [contextToken,setContextToken]=useState<string|null>(null);
  const [workflow,setWorkflow]=useState<"register"|"payment"|null>(null);
  const [announcement,setAnnouncement]=useState<AnnouncementDraft|null>(null);
  const id=useRef(0);
  const messageLog=useRef<HTMLDivElement>(null);
  const suggestions=role==="MANAGEMENT"
    ? ["Who hasn't paid?","Room 41 payments","Register a student","Record payment"]
    : ["Who has not checked out?","How many visitors are expected?","Find room 41"];
  const guides=searchSystemGuide(systemGuide(role),submitted).slice(0,3);

  // Keep scrolling inside the conversation rather than jumping the entire
  // phone viewport away from the composer when a response arrives.
  useEffect(()=>{
    const log=messageLog.current;
    if(log && messages.length) log.scrollTop=log.scrollHeight;
  },[messages.length,busy]);

  async function ask(raw:string) {
    const value=raw.trim();
    if(!value||busy)return;
    if(role==="MANAGEMENT") {
      if(transferReviewNavigationRequest(value)){router.push("/occupancy/transfers");return;}
      if(financialAuditNavigationRequest(value)){router.push("/payments/audit");return;}
      if(receiptQueueNavigationRequest(value)){router.push("/payments?delivery=all");return;}
      if(!personSearchIntent(value)) {
        const shortcut=occupancySearchShortcut(value);
        if(shortcut){router.push("/occupancy?q="+encodeURIComponent(shortcut));return;}
      }
    }
    // Send the signed, short-lived room pointer only for explicit pronoun
    // follow-ups. It is never saved to URLs, local storage, analytics or logs.
    const isFollowup=/^(?:and\s+|okay[,\s]+|then\s+|what about\s+)?(?:how much\s+(?:has|did|does)\s+(?:he|she|they|that\s+(?:student|resident|tenant))\s+(?:paid|pay|owe)|what(?:'s| is)\s+(?:his|her|their|that\s+(?:student|resident|tenant)'?s)\s+(?:balance|rent|payment)|(?:has|did)\s+(?:he|she|they)\s+pay|show\s+(?:his|her|their)\s+(?:payments?|balance)|(?:his|her|their)\s+(?:payment|rent|balance))/i.test(value.toLowerCase());
    const requestId=++id.current;
    setMessages(items=>[...items.slice(-17),{id:requestId,role:"user",text:value}]);
    setQuestion("");
    setSubmitted(value);
    setBusy(true);
    setWorkflow(null);
    setAnnouncement(null);
    try {
      const response=await fetch("/api/assistant",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({question:value,audience:role==="TENANT"?"tenant":"staff",contextToken:(isFollowup||isPersonSearchFollowup(value)||contextualBalanceFollowup(value))?contextToken:null}),
        cache:"no-store",signal:AbortSignal.timeout(35000)
      });
      const result=await response.json();
      if(!response.ok)throw Error(typeof result.error==="string"?result.error:"The assistant could not respond.");
      const links=Array.isArray(result.links)?result.links.filter(safeLink).slice(0,4):[];
      // The server signs and scopes the context after rechecking the session.
      setContextToken(typeof result.contextToken==="string"&&result.contextToken.length<=1200?result.contextToken:null);
      const text=typeof result.text==="string"?result.text:"I could not verify an answer. Please try again.";
      setMessages(items=>[...items.slice(-17),{id:++id.current,role:"assistant",text,mode:result.mode,links,voiceTicket:typeof result.voiceTicket==="string"?result.voiceTicket:undefined}]);
      if(role==="MANAGEMENT"&&workspace&&(result.workflow==="register"||result.workflow==="payment"))setWorkflow(result.workflow);
      if(role==="MANAGEMENT"&&result.workflow==="announcement"&&result.draft&&typeof result.draft==="object")setAnnouncement(result.draft as AnnouncementDraft);
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

    <div ref={messageLog} className={styles.conversation} role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions text">
      {messages.length===0 ? <div className={styles.welcome}>
        <span className={styles.welcomeIcon}><Sparkles size={24} aria-hidden="true"/></span>
        <h3>How can I help?</h3>
        <p>{role==="MANAGEMENT"
          ?"Ask about an individual room, who has paid, overdue balances, or ask me to prepare a transaction."
          :"Ask about rooms, expected visitors and gate records."}</p>
      </div> : messages.map(message=><article key={message.id} className={styles.message+" "+(message.role==="user"?styles.user:styles.assistant)}>
        <span className={styles.messageLabel}>{message.role==="user"?"You":message.mode==="records"?"Live hostel records":message.mode==="workflow"?"Action review":message.mode==="error"?"Connection issue":"Hostel Assistant"}</span>
        <div className={message.mode==="error"?styles.subtleError:styles.bubble}>{message.text}</div>
        {message.role==="assistant"&&message.mode!=="error"&&message.text.trim()?<div className={styles.narrationActions}>
          <button type="button" className={styles.narrationButton}
           aria-label={narrator.state.id===message.id&&narrator.state.status==="playing"?"Pause narration":
             narrator.state.id===message.id&&narrator.state.status==="paused"?"Resume narration":
             narrator.state.id===message.id&&narrator.state.status==="loading"?"Cancel loading voice":"Read response aloud"}
           aria-pressed={narrator.state.id===message.id&&narrator.state.status==="playing"}
           disabled={!message.voiceTicket}
           onClick={()=>{
            if(message.mode!=="ai"&&!privateNarrationConfirmed.current.has(message.id)){
              const allowed=window.confirm("Kinari's actual narrator uses OpenAI speech generation. This answer may contain private student or financial information. Do you approve sending this answer to the speech provider for reading aloud?");
              if(!allowed)return;
              privateNarrationConfirmed.current.add(message.id);
            }
            void narrator.toggle(message.id,message.text,message.voiceTicket);
           }}>
           {narrator.state.id===message.id&&narrator.state.status==="loading"?<LoaderCircle size={15} className={styles.spinning}/>:
             narrator.state.id===message.id&&narrator.state.status==="playing"?<Pause size={15}/>:
             narrator.state.id===message.id&&narrator.state.status==="paused"?<Play size={15}/>:<Volume2 size={15}/>}
           <span>{narrator.state.id===message.id&&narrator.state.status==="loading"?"Preparing voice…":
             narrator.state.id===message.id&&narrator.state.status==="playing"?"Pause":
             narrator.state.id===message.id&&narrator.state.status==="paused"?"Resume":
             message.voiceTicket?"Listen · Kinari voice":"Kinari voice unavailable"}</span>
          </button>
          {narrator.state.id===message.id&&["playing","paused","loading"].includes(narrator.state.status)?
           <button type="button" className={styles.narrationButton} onClick={narrator.stop} aria-label="Stop reading this response">
            <Square size={14}/><span>Stop</span>
           </button>:null}
          {narrator.state.id===message.id&&narrator.state.error?<span className={styles.voiceHint} role="status">{narrator.state.error}</span>:null}
        </div>:null}
        {message.links?.length ? <div className={styles.messageLinks}>
          {message.links.map(link=><Link key={link.href+link.action} href={link.href}>{link.action}<ArrowUpRight size={13} aria-hidden="true"/></Link>)}
        </div> : null}
      </article>)}
      {busy && <div className={styles.message+" "+styles.assistant}>
        <span className={styles.messageLabel}>Checking hostel records…</span>
        <div className={styles.spinner} role="status" aria-label="Assistant responding"><span/><span/><span/></div>
      </div>}
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
    <p className={styles.helper}><ShieldCheck size={12} style={{verticalAlign:"-2px"}} aria-hidden="true"/> Kinari narrator is generated on demand using OpenAI speech. Reading a private hostel answer requires your consent for that message; no ordinary phone voice is substituted. Financial changes still require confirmation.</p>
    {workflow&&workspace?<AssistantActionWorkspace key={workflow} kind={workflow} data={workspace} onClose={()=>setWorkflow(null)}/>:null}
    {announcement?<AssistantAnnouncementReview key={announcement.requestId} draft={announcement} onClose={()=>setAnnouncement(null)}/>:null}
    {submitted&&guides.length>0?<details className={styles.extras}>
      <summary>Related help and system instructions</summary>
      {guides.map(item=><div className={styles.guide} key={item.href+item.title}>
        <strong>{item.title}</strong><p>{item.body}</p><Link href={item.href}>{item.action}</Link>
      </div>)}
    </details>:null}
  </section>;
}
