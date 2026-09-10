import { StudentImportForm } from "@/components/student-import-form";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function StudentImportPage() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/students");
  return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Student register</p><h1>CSV import</h1><p>Add student, email and guardian records. Room allocation remains payment-gated.</p></div></div><StudentImportForm /></div>;
}
