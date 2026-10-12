import {redirect} from "next/navigation";
import Link from "next/link";
import {UserForm} from "@/components/user-form";
import {requireSession} from "@/lib/auth/session";

export default async function NewUser({
  searchParams,
}:{searchParams:Promise<{role?:string}>}) {
  const session=await requireSession();
  if(!["OWNER","ADMIN"].includes(session.role))redirect("/visitors");
  const query=await searchParams;
  const defaultRole=query.role==="CARETAKER"?"CARETAKER":"MANAGER";
  return <div className="form-page">
    <div className="page-heading-row">
      <div><p className="eyebrow">Access control</p><h1>Add user</h1>
        <p>Create an individual staff account; never share the Owner password.</p>
      </div>
      <Link className="secondary-button no-underline" href="/gate-readiness">
        Gate readiness
      </Link>
    </div>
    {defaultRole==="CARETAKER"?<div className="policy-banner">
      <div><strong>Caretaker/security account preparation</strong>
        <p>Confirm the employee's real name and contact, assign CARETAKER / SECURITY,
          and provide a private temporary password. This role is for operational
          gate work only, not landlord finance or user administration.
          The account is created only after you submit this form.</p>
      </div>
    </div>:null}
    <UserForm canAssignOwner={session.role==="OWNER"} defaultRole={defaultRole}/>
  </div>;
}
