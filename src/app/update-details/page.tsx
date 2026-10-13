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
    <div className="public-update-heading"><span className="public-update-icon"><LockKeyhole size={22} /></span><p className="eyebrow">Secure record update</p><h1>Confirm your student record</h1><p>Enter the name and phone number already registered with the hostel. You will only be asked for details that need completion.</p></div>
    {property ? <StudentLookupForm /> : <p>Open the update-details link on your own hostel’s published website. <Link href="/">Find your hostel</Link>. No student details have been requested.</p>}
    <p className="public-privacy-note">Your room, payments and other private hostel records are never displayed here.</p>
  </section></main>;
}
