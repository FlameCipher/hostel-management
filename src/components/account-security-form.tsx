"use client";
import { useActionState } from "react";
import { updateAccountAction } from "@/app/(app)/account/actions";
export function AccountSecurityForm({ operation, shared }: { operation: "email" | "password"; shared: boolean }) {
  const [state, action, pending] = useActionState(updateAccountAction, { error: "" });
  return <form action={action} className="panel entity-form"><h2>{operation === "email" ? "Change login email" : "Change hostel password"}</h2><input type="hidden" name="operation" value={operation}/>
    <label className="block">{shared ? "Current SYSTEM IN ONE password" : "Current hostel password"}<input className="form-input w-full" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128}/></label>
    {operation === "email" ? <><label className="block">New login email<input className="form-input w-full" name="email" type="email" autoComplete="email" required maxLength={254}/></label><label className="block">Confirm new login email<input className="form-input w-full" name="confirmEmail" type="email" autoComplete="off" required maxLength={254}/></label></> : <><label className="block">New hostel password<input className="form-input w-full" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label><label className="block">Confirm new hostel password<input className="form-input w-full" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label><p>Use at least 12 characters, up to 72 UTF-8 bytes. Spaces and password managers are supported.</p></>}
    <label><input type="checkbox" name="confirmSignOut" required/> I understand that all my existing hostel sessions will be signed out, including this browser.</label>
    {state.error && <p role="alert">{state.error}</p>}<button className="primary-button" disabled={pending}>{pending ? "Updating…" : operation === "email" ? "Update email and sign out" : "Update password and sign out"}</button>
  </form>;
}
