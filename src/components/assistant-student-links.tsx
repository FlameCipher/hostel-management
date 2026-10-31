"use client";
import { useState } from "react";
import { safeStudentLink, type StudentLink } from "@/lib/assistant-navigation";
import styles from "./assistant-chat.module.css";

export function AssistantStudentLinks({ link }: { link: StudentLink }) {
  const [status, setStatus] = useState("");
  if (!safeStudentLink(link)) return null;
  async function copy() {
    try { await navigator.clipboard.writeText(link.url); setStatus("Link copied. Paste it into your student message."); }
    catch { setStatus("Select and hold the full link above, then choose Copy."); }
  }
  async function share() {
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({ title: link.title, text: link.title, url: link.url }); }
    catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setStatus("Sharing is unavailable. Use Copy link or select the full link above."); }
  }
  return <section className={styles.shareCard} aria-label={link.title}>
    <strong>{link.title}</strong>
    <a className={styles.fullLink} href={link.url} target="_blank" rel="noopener noreferrer">{link.url}</a>
    <div className={styles.shareActions}>
      <a href={link.url} target="_blank" rel="noopener noreferrer">Open page</a>
      <button type="button" onClick={()=>void copy()}>Copy link</button>
      <button type="button" onClick={()=>void share()}>Share</button>
    </div>
    {status ? <p role="status">{status}</p> : null}
  </section>;
}
