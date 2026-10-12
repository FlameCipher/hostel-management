import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft, ClipboardList, Mail, MessageCircle, Phone, Search,
  ShieldCheck, UserRound, Users,
} from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  guardianContactHref, guardianContactSummary,
  guardianCorrectionFingerprint, guardianPhoneCorrections,
  uniqueCountry, type GuardianContactRecord,
} from "@/lib/guardian-registry";
import { GuardianNormalizationApproval } from "@/components/guardian-normalization-approval";

export default async function GuardianRegisterPage({
  searchParams,
}: {searchParams: Promise<{q?: string; view?: string}>}) {
  const session=await requireSession();
  if(session.role==="CARETAKER")redirect("/students");
  const params=await searchParams;
  const query=(params.q??"").trim().slice(0,80);
  const view=params.view==="needs-attention"?"needs-attention":"all";
  const canApprove=["OWNER","ADMIN"].includes(session.role);
  const [students,properties,pendingUpdates,totalStudents]=await Promise.all([
    db.student.findMany({
      where:{organizationId:session.organizationId},
      include:{
        guardian:true,
        occupancies:{
          where:{organizationId:session.organizationId,status:"ACTIVE"},
          select:{room:{select:{number:true}}},
          orderBy:{checkInAt:"desc"},take:1,
        },
      },
      orderBy:{fullName:"asc"},take:500,
    }),
    db.property.findMany({
      where:{organizationId:session.organizationId,active:true},
      select:{countryCode:true},
    }),
    canApprove?db.studentDetailsUpdateRequest.count({
      where:{organizationId:session.organizationId,status:"PENDING"},
    }):Promise.resolve(0),
    db.student.count({where:{organizationId:session.organizationId}}),
  ]);
  const country=uniqueCountry(properties);
  const contacts:GuardianContactRecord[]=students.flatMap(s=>s.guardian?[{
    id:s.guardian.id,studentId:s.id,
    name:s.guardian.name,phone:s.guardian.phone,
    email:s.guardian.email,relationship:s.guardian.relationship,
    student:{fullName:s.fullName,status:s.status,admissionNumber:s.admissionNumber},
  }]:[]);
  const cleanup=guardianPhoneCorrections(contacts,country);
  const preview=new Map(cleanup.map(row=>[row.id,row]));
  const counts=guardianContactSummary(contacts,country,totalStudents);
  const matching=students.filter(s=>{
    const g=s.guardian;
    if(view==="needs-attention"&&g&&!preview.has(g.id)&&
      !!guardianContactHref(g.phone,country).phoneHref&&!!g.name.trim())return false;
    if(!query)return true;
    const text=[s.fullName,s.admissionNumber??"",s.occupancies[0]?.room.number??"",
      g?.name??"",g?.phone??"",g?.email??""].join(" ").toLowerCase();
    const digits=query.replace(/\D/g,"");
    return text.includes(query.toLowerCase()) ||
      (digits.length>=5&&text.replace(/\D/g,"").includes(digits));
  });
  return <div>
    <div className="page-heading-row">
      <div>
        <p className="eyebrow">Student &amp; Guardian Management</p>
        <h1>Guardian contact register</h1>
        <p>Contact readiness, student relationships, pending updates and approved format cleanup in one place.</p>
      </div>
      <div className="heading-actions">
        <Link href="/students" className="secondary-button no-underline"><ArrowLeft size={17}/> Students</Link>
        {canApprove?<Link href="/students/update-requests" className="secondary-button no-underline">
          <ClipboardList size={17}/> Update requests{pendingUpdates?" ("+pendingUpdates+")":""}
        </Link>:null}
      </div>
    </div>
    <section className="room-summary-grid" aria-label="Guardian contact summary">
      <article className="compact-stat"><span className="metric-icon metric-blue"><Users size={21}/></span><div><p>Students</p><strong>{counts.students}</strong></div></article>
      <article className="compact-stat"><span className="metric-icon metric-green"><UserRound size={21}/></span><div><p>Guardian contacts</p><strong>{counts.guardians}</strong></div></article>
      <article className="compact-stat"><span className="metric-icon metric-violet"><Phone size={21}/></span><div><p>Ready to call</p><strong>{counts.contactReady}</strong></div></article>
      <article className="compact-stat"><span className="metric-icon metric-red"><ClipboardList size={21}/></span><div><p>Format review</p><strong>{counts.formatCorrections}</strong></div></article>
    </section>
    <div className="policy-banner mt-5">
      <ShieldCheck size={22}/>
      <div><strong>Valid contact details do not establish messaging consent.</strong>
        <p>Local Kenyan numbers can be dialed or opened in a WhatsApp composer without changing records. Clicking WhatsApp never automatically sends. Siblings sharing a guardian number are not duplicate students.</p>
      </div>
    </div>
    <section className="panel mt-5 overflow-hidden" aria-label="Guardian contact review">
      <div className="panel-heading">
        <div><p className="panel-kicker">Official student register</p>
          <h2>Guardian and student contact review</h2>
          <p className="muted-note">{counts.missingGuardians} students have no guardian attached.
            {counts.unreadablePhones?" "+counts.unreadablePhones+" guardian phones need checking.":""}
            {counts.missingEmail?" "+counts.missingEmail+" guardian emails are missing (optional).":""}
          </p>
        </div>
        <Link className="secondary-button no-underline"
          href={view==="all"?"/students/guardians?view=needs-attention":"/students/guardians"}>
          {view==="all"?"Needs attention":"Show all"}
        </Link>
      </div>
      <form method="get" className="filter-bar student-filter-bar">
        {view==="needs-attention"?<input type="hidden" name="view" value="needs-attention"/>:null}
        <label className="filter-search"><Search size={17}/>
          <input name="q" maxLength={80} defaultValue={query}
            aria-label="Search guardian contacts" placeholder="Student, guardian, room or phone"/>
        </label>
        <button type="submit" className="secondary-button">Search</button>
        {query?<Link href={view==="all"?"/students/guardians":"/students/guardians?view=needs-attention"}
          className="text-link">Clear</Link>:null}
      </form>
      {totalStudents>students.length?<p className="muted-note">
        Showing the first {students.length} students. Full contact cleanup requires reviewing every student.
      </p>:null}
      {matching.length?<div className="table-scroll"><table className="data-table">
        <thead><tr><th>Student and room</th><th>Guardian</th><th>Phone</th><th>Contact review</th><th>Actions</th></tr></thead>
        <tbody>{matching.map(s=>{
          const g=s.guardian;
          const candidate=g?preview.get(g.id):null;
          const contact=g?guardianContactHref(g.phone,country):null;
          return <tr key={s.id}>
            <td><strong>{s.fullName}</strong>
              <small className="table-subtext">{s.status}{s.occupancies[0]?" · Room "+s.occupancies[0].room.number:" · No active room"}</small>
              {s.admissionNumber?<small className="table-subtext">{s.admissionNumber}</small>:null}
            </td>
            <td>{g?<><strong>{g.name}</strong>
                <small className="table-subtext">{g.relationship??"Relationship not recorded"}</small>
                {g.email?<small className="table-subtext">{g.email}</small>:null}
              </>:<span className="status-pill status-maintenance">Not provided</span>}</td>
            <td>{g?<><span>{g.phone}</span>
              {candidate?<small className="table-subtext">After approval: {candidate.newPhone}</small>:null}
              </>:<span>—</span>}</td>
            <td>{!g?<span className="status-pill status-maintenance">Add guardian</span>:
              candidate?<span className="status-pill status-partial">Formatting available</span>:
              contact?.phoneHref?<span className="status-pill status-full">Contact valid</span>:
                <span className="status-pill status-maintenance">Check phone</span>}</td>
            <td><div className="row-actions">
              <Link className="table-action" href={"/students/"+encodeURIComponent(s.id)+"/edit"}>Edit</Link>
              {contact?.phoneHref?<a className="table-action" href={contact.phoneHref} aria-label={"Call guardian for "+s.fullName}><Phone size={15}/> Call</a>:null}
              {contact?.whatsappHref?<a className="table-action" href={contact.whatsappHref}
                target="_blank" rel="noopener noreferrer" aria-label={"Open WhatsApp for guardian of "+s.fullName}>
                <MessageCircle size={15}/> WhatsApp</a>:null}
              {g?.email?<a className="table-action" href={"mailto:"+g.email}><Mail size={15}/> Email</a>:null}
            </div></td>
          </tr>;
        })}</tbody>
      </table></div>:<div className="inline-empty"><UserRound size={24}/>
        <strong>No matching guardian contacts</strong>
        <p>Adjust the search or open the full student register.</p>
      </div>}
    </section>
    {canApprove&&cleanup.length>0&&cleanup.length<=200&&totalStudents===students.length?
      <div className="mt-5"><GuardianNormalizationApproval count={cleanup.length}
        fingerprint={guardianCorrectionFingerprint(cleanup)}/></div>:null}
    {canApprove&&cleanup.length>0&&totalStudents!==students.length?
      <p className="form-error" role="status">Preview incomplete; bulk approval is disabled until all students can be reviewed.</p>:null}
    {canApprove&&cleanup.length>200?
      <p className="form-error" role="status">Too many eligible contacts for one operation. Review in smaller batches.</p>:null}
    {cleanup.length===0?<section className="panel mt-5">
      <strong>No guardian phone-format corrections currently available.</strong>
      <p className="muted-note">{country==="KE"?
        "No saved eligible Kenyan local mobile numbers require conversion.":
        "Review the hostel country settings before attempting local phone conversion."}</p>
    </section>:null}
  </div>;
}
