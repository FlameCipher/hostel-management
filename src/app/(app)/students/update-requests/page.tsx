import { redirect } from "next/navigation";
import { CheckCircle2, ClipboardList, Clock3, Phone, UserRound, XCircle } from "lucide-react";
import { StudentUpdateReviewActions } from "@/components/student-update-review-actions";
import { CopyStudentUpdateLink } from "@/components/copy-student-update-link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

function value(value: string | null | undefined) {
  return value || "Not provided";
}

export default async function StudentUpdateRequestsPage() {
  const session = await requireSession();
  if (!["OWNER", "ADMIN"].includes(session.role)) redirect("/students");
  const requests = await db.studentDetailsUpdateRequest.findMany({
    where: { organizationId: session.organizationId },
    include: { student: { include: { guardian: true } }, reviewedBy: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  const pending = requests.filter((item) => item.status === "PENDING").length;
  const approved = requests.filter((item) => item.status === "APPROVED").length;
  const rejected = requests.filter((item) => item.status === "REJECTED").length;

  return <div>
    <div className="page-heading-row"><div><p className="eyebrow">Student data completion</p><h1>Detail update requests</h1><p>Review student submissions before changing the official register.</p></div><CopyStudentUpdateLink /></div>
    <section className="room-summary-grid" aria-label="Update request summary"><article className="compact-stat"><span className="metric-icon metric-blue"><ClipboardList size={22} /></span><div><p>Total requests</p><strong>{requests.length}</strong></div></article><article className="compact-stat"><span className="metric-icon metric-sky"><Clock3 size={22} /></span><div><p>Pending review</p><strong>{pending}</strong></div></article><article className="compact-stat"><span className="metric-icon metric-green"><CheckCircle2 size={22} /></span><div><p>Approved</p><strong>{approved}</strong></div></article><article className="compact-stat"><span className="metric-icon metric-red"><XCircle size={22} /></span><div><p>Rejected</p><strong>{rejected}</strong></div></article></section>
    <section className="update-request-list mt-5">{requests.length ? requests.map((request) => <article className="panel update-request-card" key={request.id}>
      <header><div><p className="panel-kicker">Submitted {request.createdAt.toLocaleDateString("en-KE", { dateStyle: "medium" })}</p><h2>{request.student.fullName}</h2><a className="table-phone" href={`tel:${request.student.phone}`}><Phone size={11} /> {request.student.phone}</a></div><span className={`status-pill ${request.status === "APPROVED" ? "status-paid" : request.status === "REJECTED" ? "status-maintenance" : "status-due"}`}>{request.status}</span></header>
      <div className="update-comparison-grid">
        <section><h3>Student details</h3><dl className="detail-list"><div><dt>Email</dt><dd><span>{value(request.student.email)}</span><strong>{request.email ? `Proposed: ${request.email}` : "No change"}</strong></dd></div><div><dt>Admission number</dt><dd><span>{value(request.student.admissionNumber)}</span><strong>{request.admissionNumber ? `Proposed: ${request.admissionNumber}` : "No change"}</strong></dd></div><div><dt>National ID</dt><dd><span>{value(request.student.nationalId)}</span><strong>{request.nationalId ? `Proposed: ${request.nationalId}` : "No change"}</strong></dd></div></dl></section>
        <section><h3>Guardian details</h3><dl className="detail-list"><div><dt>Name</dt><dd><span>{value(request.student.guardian?.name)}</span><strong>Proposed: {request.guardianName}</strong></dd></div><div><dt>Relationship</dt><dd><span>{value(request.student.guardian?.relationship)}</span><strong>Proposed: {request.guardianRelationship}</strong></dd></div><div><dt>Phone</dt><dd><span>{value(request.student.guardian?.phone)}</span><strong>Proposed: {request.guardianPhone}</strong></dd></div><div><dt>Email</dt><dd><span>{value(request.student.guardian?.email)}</span><strong>{request.guardianEmail ? `Proposed: ${request.guardianEmail}` : "No email submitted"}</strong></dd></div></dl></section>
      </div>
      {request.status === "PENDING" ? <StudentUpdateReviewActions requestId={request.id} /> : <p className="reviewed-note">{request.status === "APPROVED" ? "Approved" : "Rejected"}{request.reviewedBy ? ` by ${request.reviewedBy.name}` : ""}{request.reviewedAt ? ` on ${request.reviewedAt.toLocaleDateString("en-KE", { dateStyle: "medium" })}` : ""}{request.reviewNotes ? ` · ${request.reviewNotes}` : ""}</p>}
    </article>) : <div className="panel inline-empty"><UserRound size={27} /><strong>No student update requests</strong><p>New submissions from the public update page will appear here.</p></div>}</section>
  </div>;
}
