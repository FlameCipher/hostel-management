import Link from "next/link";
import { Building2, Clock3, ShieldCheck } from "lucide-react";
import { StudentDetailsUpdateForm } from "@/components/student-details-update-forms";
import { db } from "@/lib/db";
import { getStudentUpdateSession } from "@/lib/student-update-session";

function maskPhone(value: string) {
  if (value.length < 7) return "••••••";
  return `${value.slice(0, 4)}•••${value.slice(-3)}`;
}

export default async function StudentDetailsFormPage() {
  const session = await getStudentUpdateSession();
  const student = session ? await db.student.findFirst({
    where: { id: session.studentId, organizationId: session.organizationId, status: "ACTIVE" },
    select: { email: true, admissionNumber: true, nationalId: true, organization: { select: { name: true } }, detailsUpdateRequests: { where: { status: "PENDING" }, select: { id: true }, take: 1 } },
  }) : null;
  if (!session || !student) return <main className="public-update-page"><section className="public-update-card public-message-card"><Clock3 size={30} /><h1>Verification required</h1><p>Your secure session has expired. Verify your name and phone number again.</p><Link className="primary-button no-underline" href="/update-details">Return to verification</Link></section></main>;

  if (student.detailsUpdateRequests.length) return <main className="public-update-page"><section className="public-update-card public-message-card"><ShieldCheck size={34} /><h1>Update already submitted</h1><p>Your details are waiting for review by the hostel office. You do not need to submit them again.</p></section></main>;

  return <main className="public-update-page"><section className="public-update-card public-update-card-wide">
    <div className="public-update-brand"><span className="brand-mark"><Building2 size={21} /></span><div><strong>{student.organization.name}</strong><span>Student details update</span></div></div>
    <div className="public-update-heading"><span className="public-update-icon"><ShieldCheck size={22} /></span><p className="eyebrow">Record verified</p><h1>Complete your details</h1><p>Verified as <strong>{session.submittedName}</strong> · {maskPhone(session.submittedPhone)}. Stored private values are not displayed.</p></div>
    <StudentDetailsUpdateForm missing={{ email: !student.email, admissionNumber: !student.admissionNumber, nationalId: !student.nationalId }} />
  </section></main>;
}
