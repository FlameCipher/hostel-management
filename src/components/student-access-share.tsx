"use client";
import { useState } from "react";
import { Copy, Link2 } from "lucide-react";

export function StudentAccessShare({url,message}:{url:string;message:string}) {
  const [status,setStatus]=useState("");
  async function copy(value:string,what:string) {
    try {
      if (!navigator.clipboard?.writeText) throw Error("Clipboard not available");
      await navigator.clipboard.writeText(value);
      setStatus(`${what} copied. Paste into your student WhatsApp group or chosen channel.`);
    } catch {
      setStatus("Automatic copying is not available on this device. Long-press the displayed link to copy it.");
    }
  }
  return <div className="entity-form">
    <p>Use one public link for existing residents. Share through the student group or another verified channel; the system will not send or approve anyone automatically.</p>
    <p><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></p>
    <div className="heading-actions">
      <button type="button" className="primary-button" onClick={()=>void copy(message,"Student instructions")}><Copy size={17} aria-hidden="true"/> Copy student instructions</button>
      <button type="button" className="secondary-button" onClick={()=>void copy(url,"Registration link")}><Link2 size={17} aria-hidden="true"/> Copy link only</button>
    </div>
    {status?<p role="status" aria-live="polite">{status}</p>:null}
    <p className="muted-note">Students with an unexpired personal invitation should use that link first. Every new request still needs independent identity verification before activation.</p>
  </div>;
}
