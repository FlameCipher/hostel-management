import Link from "next/link";
import { CircleCheck } from "lucide-react";

export default function StudentDetailsSubmittedPage() {
  return <main className="public-update-page"><section className="public-update-card public-message-card"><span className="success-mark"><CircleCheck size={34} /></span><p className="eyebrow">Submission received</p><h1>Thank you</h1><p>Your information has been sent to the hostel office for review. The official record will be updated after approval.</p><Link className="secondary-button no-underline" href="/update-details">Done</Link></section></main>;
}
