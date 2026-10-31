"use client";
import { useState } from "react";
export function RentRequestShare({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  if (!/^[\w-]{43}$/.test(token)) return null;
  const url = "https://mmambugua.studentshostels.com/rent-request/" + token;
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMessage("Link copied. Share it with the intended payer."); }
    catch { setMessage("Select the full link and choose Copy."); }
  }
  async function share() {
    if (!navigator.share) return copy();
    try { await navigator.share({ title: "MMAMBUGUA HOSTEL rent payment request", url }); }
    catch { setMessage("You can use Copy link instead."); }
  }
  return <div><a href={url} style={{ overflowWrap: "anywhere" }}>{url}</a><div className="heading-actions"><button type="button" className="secondary-button" onClick={copy}>Copy payment link</button><button type="button" className="secondary-button" onClick={share}>Share payment request</button></div><p>Share only with the intended payer. Opening a share window does not send the message.</p>{message && <p role="status">{message}</p>}</div>;
}
