"use client";
import { useState } from "react";
export function ServicePageLink({ title, path }: { title: string; path: string }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(new URL(path, window.location.origin).href); setStatus("Link copied. Staff sign-in is required."); }
    catch { setStatus("Open the page and copy its address from your browser."); }
  }
  return <article className="panel" style={{padding:16}}><strong>{title}</strong><p><a href={path}>Open page</a> · <button type="button" className="secondary-button" onClick={()=>void copy()}>Copy staff link</button></p><small>Staff sign-in and the correct permission are required.</small>{status && <p role="status">{status}</p>}</article>;
}
