import { redirect } from "next/navigation";
import { SemesterForm } from "@/components/semester-form";
import { requireSession } from "@/lib/auth/session";
export default async function NewSemesterPage() { const session = await requireSession(); if (session.role === "CARETAKER") redirect("/semesters"); return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Academic calendar</p><h1>Add semester</h1><p>Configure the next rent-bearing academic period.</p></div></div><SemesterForm /></div>; }
