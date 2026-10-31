import { StudentUpdateSteps } from "@/components/student-update-steps";
import Link from "next/link";
import { CircleCheck } from "lucide-react";

export default function StudentDetailsSubmittedPage() {
  return <main className="public-update-page"><section className="public-update-card public-message-card"><span className="success-mark"><CircleCheck size={34} /></span><p className="eyebrow">Submission received</p><h1>Your details have been submitted</h1><StudentUpdateSteps current={3}/><p>The hostel office will review your information. Your record changes only after approval. You do not need to submit again.</p><p>This update does not activate portal access. If you need an online account, <Link href="/tenant/register">request student access</Link>.</p><Link className="secondary-button no-underline" href="/tenant/login">Already have an account? Sign in</Link></section></main>;
}
