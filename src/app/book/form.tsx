"use client";
import { formatMoney } from "@/lib/currency";
import Link from "next/link";
import { useActionState } from "react";
import { bookingAction } from "./actions";
import type { BookingState } from "@/lib/booking-requests";
export function BookingForm({currency,ticket,options,selected,today}:{currency:string;ticket:string;options:{id:string;name:string;monthlyRate:number;semesterRate:number;available:number}[];selected:string;today:string}){
 const money=(v:number)=>formatMoney(v,currency);
 const [state,action,pending]=useActionState(bookingAction,{} as BookingState);
 if(state.reference)return<section className="panel entity-form" role="status"><h2>Request received</h2><p>Your reference: <strong>{state.reference}</strong></p><p>Save this reference. Management will contact you to confirm the room, payment instructions and check-in arrangements. Your request has not reserved a room and no payment has been recorded.</p><Link className="secondary-button" href="/">Return to hostel website</Link></section>;
 return<form className="panel entity-form" action={action}>
 <input type="hidden" name="ticket" value={ticket}/><div style={{display:"none"}} aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
 <label className="field-group"><span>Room type *</span><select name="roomTypeId" defaultValue={selected} required>{options.map(o=><option key={o.id} value={o.id}>{o.name} · {money(o.monthlyRate)}/month · {money(o.semesterRate)}/semester · {o.available} available</option>)}</select></label>
 <label className="field-group"><span>Full name *</span><input name="fullName" autoComplete="name" required minLength={2} maxLength={120}/></label>
 <label className="field-group"><span>Mobile number *</span><input name="phone" type="tel" autoComplete="tel" required maxLength={24}/></label>
 <label className="field-group"><span>Email (optional)</span><input name="email" type="email" autoComplete="email" maxLength={254}/></label>
 <label className="field-group"><span>Preferred move-in date *</span><input name="preferredMoveIn" type="date" min={today} required/></label>
 <label className="flex gap-3"><input name="consent" type="checkbox" required/><span>I agree that this hostel may use these details to contact me about my request.</span></label>
 <p>Management confirms availability and payment instructions. Submit only your contact details; do not enter a PIN or bank password. Accommodation terms are accepted separately when you join the hostel.</p>
 {state.error&&<p className="form-error" role="alert">{state.error}</p>}<button className="primary-button" disabled={pending}>{pending?"Sending request…":"Send booking request"}</button>
 </form>;
}
