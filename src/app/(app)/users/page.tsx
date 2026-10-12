import Link from "next/link";
import {Pencil,Plus,ShieldCheck,Users} from "lucide-react";
import {redirect} from "next/navigation";
import {requireSession} from "@/lib/auth/session";
import {db} from "@/lib/db";

export default async function UsersPage(){
  const session=await requireSession();
  if(!["OWNER","ADMIN"].includes(session.role))redirect("/visitors");
  const users=await db.user.findMany({
    where:{organizationId:session.organizationId},
    orderBy:[{role:"asc"},{name:"asc"}],
  });
  const activeGateStaff=users.filter(u=>u.active&&u.role==="CARETAKER").length;
  return <div>
    <div className="page-heading-row">
      <div><p className="eyebrow">Access control</p><h1>Users and permissions</h1>
        <p>Assign one private login to each authorized employee. Never share the Owner account.</p>
      </div>
      <div className="heading-actions">
        <Link className="secondary-button no-underline" href="/gate-readiness">
          <ShieldCheck size={17}/> Gate readiness
        </Link>
        <Link className="primary-button no-underline" href="/users/new">
          <Plus size={17}/> Add user
        </Link>
      </div>
    </div>
    <section className="room-summary-grid">
      <article className="compact-stat"><span className="metric-icon metric-blue"><Users size={22}/></span>
        <div><p>Total staff accounts</p><strong>{users.length}</strong></div></article>
      <article className="compact-stat"><span className="metric-icon metric-green"><ShieldCheck size={22}/></span>
        <div><p>Active staff</p><strong>{users.filter(u=>u.active).length}</strong></div></article>
      <article className="compact-stat">
        <div><p>Active caretaker/security</p><strong>{activeGateStaff}</strong></div>
      </article>
    </section>
    {activeGateStaff===0?<div className="policy-banner mt-5">
      <ShieldCheck size={20}/>
      <div><strong>No dedicated gate operator has been enrolled yet.</strong>
        <p>Visitor verification is available to Owner/Admin while staffing is prepared.
          Add a real caretaker/security employee using a named account and review
          their limited gate permissions before handing over duty.</p>
        <Link href="/users/new?role=CARETAKER" className="secondary-button no-underline">
          Prepare caretaker/security account
        </Link>
      </div>
    </div>:null}
    <section className="panel mt-5 overflow-hidden">
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>User</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th/></tr></thead>
        <tbody>{users.map(user=><tr key={user.id}>
          <td><strong>{user.name}</strong></td>
          <td>{user.email}</td><td>{user.phone??"—"}</td>
          <td><span className="status-pill status-vacant-pill">
            {user.role==="CARETAKER"?"CARETAKER / SECURITY":user.role}
          </span></td>
          <td>{user.active?"Active":"Inactive"}</td>
          <td><Link className="table-action" href={"/users/"+encodeURIComponent(user.id)+"/edit"}>
            <Pencil size={14}/> Edit</Link></td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </div>;
}
