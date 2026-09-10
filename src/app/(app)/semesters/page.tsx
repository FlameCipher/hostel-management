import Link from "next/link";
import { CalendarDays, CircleCheck, LockKeyhole, Plus } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { activateSemesterAction, closeSemesterAction } from "./actions";

export default async function SemestersPage() {
  const session = await requireSession();
  const canManage = session.role !== "CARETAKER";
  const semesters = await db.semester.findMany({ where: { organizationId: session.organizationId }, include: { _count: { select: { occupancies: true, charges: true } } }, orderBy: { startDate: "desc" } });
  return <div><div className="page-heading-row"><div><p className="eyebrow">Academic calendar</p><h1>Semesters</h1><p>Rent is generated only when a student checks into an active semester.</p></div>{canManage ? <Link className="primary-button no-underline" href="/semesters/new"><Plus size={17} /> Add semester</Link> : null}</div><section className="panel overflow-hidden">{semesters.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Semester</th><th>Dates</th><th>Payable months</th><th>Occupancies</th><th>Charges</th><th>Status</th>{canManage ? <th>Action</th> : null}</tr></thead><tbody>{semesters.map((semester) => <tr key={semester.id}><td><strong>{semester.name}</strong></td><td>{semester.startDate.toLocaleDateString("en-KE", { timeZone: "UTC" })} – {semester.endDate.toLocaleDateString("en-KE", { timeZone: "UTC" })}</td><td>{semester.months}</td><td>{semester._count.occupancies}</td><td>{semester._count.charges}</td><td><span className={`status-pill ${semester.status === "ACTIVE" ? "status-full" : semester.status === "CLOSED" ? "status-inactive" : "status-partial"}`}>{semester.status}</span></td>{canManage ? <td>{semester.status === "UPCOMING" ? <form action={activateSemesterAction}><input name="semesterId" type="hidden" value={semester.id} /><button className="table-action"><CircleCheck size={14} /> Activate</button></form> : semester.status === "ACTIVE" ? <form action={closeSemesterAction}><input name="semesterId" type="hidden" value={semester.id} /><button className="table-action danger-link"><LockKeyhole size={14} /> Close</button></form> : null}</td> : null}</tr>)}</tbody></table></div> : <div className="inline-empty"><CalendarDays size={25} /><strong>No semesters configured</strong></div>}</section></div>;
}
