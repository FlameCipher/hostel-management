"use client";
import { PasswordInput } from "@/components/password-input";
import { FormSelect } from "@/components/form-select";
import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { createUserAction, updateUserAction, type UserFormState } from "@/app/(app)/users/actions";

const initial: UserFormState = { error: "" };
type StaffProfile = {
  id: string; name: string; email: string | null; phone: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "CARETAKER"; active: boolean;
  loginPhone?: string | null; dutyStart?: string | null; dutyEnd?: string | null; dutyTimeZone?: string | null;
};
export function UserForm({ user, canAssignOwner, defaultRole, defaultTimeZone = "UTC" }: {
  user?: StaffProfile; canAssignOwner: boolean; defaultRole?: "MANAGER" | "CARETAKER"; defaultTimeZone?: string;
}) {
  const action = user ? updateUserAction.bind(null, user.id) : createUserAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const [role, setRole] = useState<string>(user?.role ?? defaultRole ?? "MANAGER");
  const roles = canAssignOwner ? ["OWNER", "ADMIN", "MANAGER", "CARETAKER"] : ["ADMIN", "MANAGER", "CARETAKER"];
  const caretaker = role === "CARETAKER";
  return <form action={formAction} className="panel entity-form">
    <div className="form-section-heading"><div><p className="panel-kicker">Access control</p><h2>{user ? "Edit user" : "Add user"}</h2></div></div>
    <div className="form-grid">
      <label className="field-group"><span>Name *</span><input defaultValue={user?.name} name="name" maxLength={100} required/></label>
      <label className="field-group"><span>Role *</span>
        <FormSelect value={role} onValueChange={setRole} name="role">{roles.map(r => <option key={r} value={r}>{r === "CARETAKER" ? "CARETAKER / SECURITY" : r}</option>)}</FormSelect>
      </label>
      <label className="field-group"><span>{caretaker ? "Email (optional)" : "Email *"}</span><input defaultValue={user?.email ?? ""} name="email" type="email" maxLength={254} required={!caretaker}/></label>
      <label className="field-group"><span>{caretaker ? "Phone (required without email)" : "Phone"}</span><input defaultValue={user?.phone} name="phone" type="tel" maxLength={30} placeholder="+254…"/></label>
      {caretaker && <p className="form-span-2">No email? Leave it blank and enter the employee's international phone number, starting with + and the country code. They will sign in with that number and their password on this hostel website. {user?.loginPhone ? "Phone sign-in stays available if an email is added." : ""}</p>}
      <label className="field-group form-span-2"><span>{user ? "New password" : "Temporary password *"}</span><PasswordInput minLength={user ? 0 : 12} maxLength={128} name="password" autoComplete="new-password" placeholder={user ? "Leave blank to retain current password" : "At least 12 characters"} required={!user}/></label>
      <label className="field-group"><span>Duty starts (optional)</span><input name="dutyStart" type="time" defaultValue={user?.dutyStart ?? ""}/></label>
      <label className="field-group"><span>Duty ends (optional)</span><input name="dutyEnd" type="time" defaultValue={user?.dutyEnd ?? ""}/></label>
      <label className="field-group form-span-2"><span>Duty time zone</span><input name="dutyTimeZone" defaultValue={user?.dutyTimeZone ?? defaultTimeZone} maxLength={80} placeholder="Africa/Nairobi"/></label>
      <p className="form-span-2">These are planned shift hours. Arrange duty days and any overnight cover with the employee. Saving hours does not confirm attendance or automatically change notifications.</p>
      <label className="check-field"><input defaultChecked={user?.active ?? true} name="active" type="checkbox"/><span>Account is active</span></label>
    </div>
    <p>Owners control the hostel. Admins manage settings and staff; managers handle daily operations; caretaker/security accounts handle operational duties, including visitor verification. Disabling a user or changing their sign-in details or role signs them out. Give the temporary password privately and ask the employee to change it in My Account. Without email, the Owner/Admin must verify their identity before resetting a forgotten password.</p>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    <div className="form-actions"><Link className="secondary-button no-underline" href="/users"><ArrowLeft size={17}/> Cancel</Link><button className="primary-button" disabled={pending}><Save size={17}/> Save user</button></div>
  </form>;
}
