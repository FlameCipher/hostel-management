import Link from "next/link";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { getTenantProfile } from "@/lib/student-profile";
import { StudentDetailsUpdateForm } from "@/components/student-details-update-forms";

export const metadata = { title: "Confirm my student record", robots: { index: false, follow: false } };

export default async function TenantProfilePage() {
  const student = await getTenantProfile(db, await requireTenantSession());
  if (!student) return <main className="marketing-section"><h1>Record unavailable</h1><p>Contact management to check your student record.</p><Link href="/tenant/account">My account</Link></main>;
  const latest = student.detailsUpdateRequests[0];
  const fields = [
    ["Full name", student.fullName], ["Registered phone", student.phone],
    ["University", student.university], ["Room", student.occupancies[0]?.room.number],
    ["Email", student.email], ["Admission number", student.admissionNumber],
    ["Identification number", student.nationalId],
  ];
  return <main className="marketing-section">
    <div className="page-heading-row"><div><p className="eyebrow">{student.organization.name}</p><h1>Confirm my student record</h1>
      <p>Your landlord has already enrolled you. Check your existing record and complete the missing information below.</p></div><Link className="secondary-button" href="/tenant/account">My account and payments</Link></div>
    <section className="panel entity-form"><h2>My registered details</h2>
      <dl className="form-grid">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd style={{ margin: 0, fontWeight: 600, overflowWrap: "anywhere" }}>{value || "Not yet supplied"}</dd></div>)}</dl>
      <p>For corrections to details already recorded, <Link href="/tenant/contact">contact management</Link>. Room allocation, charges and payments are managed by the hostel.</p>
    </section>
    {latest ? <section className="panel entity-form mt-5" role="status"><h2>{latest.status === "PENDING" ? "Confirmation awaiting management review" : latest.status === "APPROVED" ? "Details confirmed and approved" : "Details need another review"}</h2>
      <p>Submitted {latest.consentConfirmedAt.toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" })}.</p>
      {latest.status === "PENDING" ? <p>Your existing student record remains in place. You do not need to submit again while management reviews your details.</p> : null}
      {latest.status === "REJECTED" && latest.reviewNotes ? <p>{latest.reviewNotes}</p> : null}
    </section> : null}
    {latest?.status !== "PENDING" ? <section className="panel entity-form mt-5"><h2>Complete and confirm my details</h2><p>Check your guardian or emergency contact details. Management reviews your submission before updating the official record.</p>
      <StudentDetailsUpdateForm portal missing={{ email: !student.email, admissionNumber: !student.admissionNumber, nationalId: !student.nationalId }} guardian={student.guardian} />
    </section> : null}
  </main>;
}
