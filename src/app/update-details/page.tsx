import { StudentUpdateSteps } from "@/components/student-update-steps";
import type { Metadata } from "next";
import { Building2, LockKeyhole } from "lucide-react";
import { StudentLookupForm } from "@/components/student-details-update-forms";
import { requestPropertyContext } from "@/lib/property-host";
import Link from "next/link";

export const metadata: Metadata = { title: "Update student details" };
export const dynamic = "force-dynamic";

export default async function UpdateDetailsPage() {
  // Never take the first organization in a multi-hostel system. Property-specific
  // update links resolve only the currently published hostname.
  const {property}=await requestPropertyContext();
  return <main className="public-update-page"><section className="public-update-card">
    <div className="public-update-brand"><span className="brand-mark"><Building2 size={21} /></span><div><strong>{property?.name ?? "Find your hostel"}</strong><span>Student details update</span></div></div>
    <div className="public-update-heading"><span className="public-update-icon"><LockKeyhole size={22} /></span><p className="eyebrow">For existing students</p><h1>Update your student details</h1><p>Already registered by the hostel? Complete your missing contact and student details here. You do not need a portal password for this update.</p></div>
    {property ? <StudentUpdateSteps current={1}/> : null}
    {property ? <p>Have portal access? <Link href="/tenant/profile">Sign in to view and confirm your full record</Link>.</p> : null}
    {property ? <StudentLookupForm /> : <p>Open the update-details link on your own hostel’s published website. <Link href="/">Find your hostel</Link>. No student details have been requested.</p>}
    <details className="student-update-help"><summary>Need help finding your record?</summary><p>Use the name and phone number you gave the hostel when you joined. If your number has changed or the record is not found, contact the hostel office to verify your details. Do not register a second student record.</p><p>New to this hostel? <Link href="/book">Apply for accommodation</Link>.</p></details>
    <p className="public-privacy-note">Your room, payments and other private hostel records are never displayed here.</p>
  </section></main>;
}
