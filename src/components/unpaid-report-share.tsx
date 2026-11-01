"use client";
import { useState } from "react";
type Contact = { id: string; name: string; role: string; phone: string };
export function UnpaidReportShare({ contacts, fingerprint }: { contacts: Contact[]; fingerprint: string }) {
  const [recipientId,setRecipientId]=useState(""),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
  const [prepared,setPrepared]=useState<{file:File;recipient:Contact}|null>(null);
  const recipient=contacts.find(contact=>contact.id===recipientId);
  function clear(){setPrepared(null);setConfirmed(false);setStatus("");}
  async function prepare(){
    if(!recipient || !confirmed || busy)return;
    setBusy(true);setPrepared(null);setStatus("");
    try {
      const response=await fetch("/reports/unpaid/pdf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipientId,recipientPhone:recipient.phone,fingerprint,confirmed})});
      if(!response.ok){const result=await response.json();throw Error(result.error||"Could not prepare the PDF.");}
      if(!response.headers.get("content-type")?.includes("application/pdf"))throw Error("Sign in again and reopen the report.");
      const file=new File([await response.blob()],"unpaid-rent-staff.pdf",{type:"application/pdf"});
      setPrepared({file,recipient});setStatus("PDF ready. No message has been sent.");
    }catch(error){setStatus(error instanceof Error?error.message:"Could not prepare the PDF.");}finally{setBusy(false);}
  }
  async function share(){
    if(!prepared)return;
    if(!navigator.canShare?.({files:[prepared.file]})){setStatus("This browser cannot share PDF files directly. Download the PDF, open the staff WhatsApp chat below, then attach it as a document.");return;}
    try{await navigator.share({files:[prepared.file],title:"Confidential unpaid rent report",text:"Private rent follow-up report for "+prepared.recipient.name+". Honour agreed payment dates."});setStatus("Passed to your sharing app. Check the intended WhatsApp contact and complete sending there; delivery is not confirmed here.");}
    catch(error){if(!(error instanceof Error&&error.name==="AbortError"))setStatus("Sharing is unavailable. Download the PDF and attach it in the staff WhatsApp chat.");}
  }
  function download(){if(!prepared)return;const url=URL.createObjectURL(prepared.file),a=document.createElement("a");a.href=url;a.download=prepared.file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="panel entity-form" style={{padding:20}}><h2>Share privately with staff</h2><label className="field-group"><span>Staff or caretaker contact</span><select value={recipientId} onChange={e=>{setRecipientId(e.target.value);clear();}}><option value="">Choose an active staff contact</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.name} · {contact.role} · +{contact.phone}</option>)}</select></label>{!contacts.length&&<p>Add a valid staff phone number under Users &amp; Permissions first.</p>}<label className="check-field"><input type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);setPrepared(null);}}/>I have reviewed the report below and authorise sharing it privately with this staff member.</label><button className="primary-button" type="button" disabled={!recipient||!confirmed||busy} onClick={()=>void prepare()}>{busy?"Preparing PDF…":"Prepare staff PDF"}</button>{prepared&&<div><p>Intended recipient: <strong>{prepared.recipient.name} · +{prepared.recipient.phone}</strong>. Choose this person in WhatsApp, not a group.</p><div style={{display:"flex",gap:12,flexWrap:"wrap"}}><button type="button" className="primary-button" onClick={()=>void share()}>Share PDF — choose WhatsApp</button><button type="button" className="secondary-button" onClick={download}>Download PDF</button><a className="secondary-button" href={`https://wa.me/${prepared.recipient.phone}?text=${encodeURIComponent("Private rent follow-up report. Please see the attached PDF and honour agreed payment dates.")}`} target="_blank" rel="noopener noreferrer">Open staff WhatsApp chat</a></div><p>The chat link opens a text draft. If you use it, attach the downloaded PDF before sending.</p></div>}{status&&<p role="status">{status}</p>}</section>;
}
