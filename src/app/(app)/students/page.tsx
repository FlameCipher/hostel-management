import Link from "next/link";
import { FileUp, GraduationCap, Pencil, Phone, Plus, Search, ShieldAlert, UserCheck, UserRound } from "lucide-react";
import { StudentStatus, type StudentStatus as StudentStatusType } from "@/generated/prisma/enums";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { studentStatusLabels, studentStatusTone } from "@/lib/students";

type StudentsPageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

const validStatuses = new Set<string>(Object.values(StudentStatus));

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const session = await requireSession();
  const filters = await searchParams;
  const query = filters.q?.trim() ?? "";
  const status = validStatuses.has(filters.status ?? "")
    ? (filters.status as StudentStatusType)
    : undefined;
  const canManageStudents = session.role !== "CARETAKER";

  const [students, statusCounts] = await Promise.all([
    db.student.findMany({
      where: {
        organizationId: session.organizationId,
        ...(status ? { status } : {}),
        ...(query ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
            { admissionNumber: { contains: query, mode: "insensitive" } },
            { guardian: { is: { name: { contains: query, mode: "insensitive" } } } },
          ],
        } : {}),
      },
      include: {
        guardian: true,
        occupancies: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            room: { select: { number: true } },
            semester: { select: { name: true } },
          },
          orderBy: { checkInAt: "desc" },
          take: 1,
        },
      },
      orderBy: { fullName: "asc" },
    }),
    db.student.groupBy({
      by: ["status"],
      where: { organizationId: session.organizationId },
      _count: { _all: true },
    }),
  ]);

  const count = (value: StudentStatusType) => statusCounts.find((item) => item.status === value)?._count._all ?? 0;
  const total = statusCounts.reduce((sum, item) => sum + item._count._all, 0);

  return (
    <div>
      <div className="page-heading-row">
        <div><p className="eyebrow">Tenant management</p><h1>Students</h1><p>Manage student records, JKUAT details, guardians and current accommodation.</p></div>
        {canManageStudents ? <div className="heading-actions"><Link className="secondary-button no-underline" href="/students/import"><FileUp size={18} /> Import CSV</Link><Link className="primary-button no-underline" href="/students/new"><Plus size={18} /> Add student</Link></div> : null}
      </div>

      <section className="room-summary-grid" aria-label="Student summary">
        <article className="compact-stat"><span className="metric-icon metric-blue"><GraduationCap size={22} /></span><div><p>Total students</p><strong>{total}</strong></div></article>
        <article className="compact-stat"><span className="metric-icon metric-green"><UserCheck size={22} /></span><div><p>Active</p><strong>{count("ACTIVE")}</strong></div></article>
        <article className="compact-stat"><span className="metric-icon metric-red"><ShieldAlert size={22} /></span><div><p>Suspended</p><strong>{count("SUSPENDED")}</strong></div></article>
        <article className="compact-stat"><span className="metric-icon metric-violet"><UserRound size={22} /></span><div><p>Checked out</p><strong>{count("CHECKED_OUT")}</strong></div></article>
      </section>

      <section className="panel mt-5 overflow-hidden">
        <div className="panel-heading room-list-heading"><div><p className="panel-kicker">Student register</p><h2>{students.length} matching student{students.length === 1 ? "" : "s"}</h2></div></div>
        <form className="filter-bar student-filter-bar" method="get">
          <label className="filter-search"><Search size={17} /><input defaultValue={query} name="q" placeholder="Search name, phone, admission or guardian" /></label>
          <select aria-label="Filter by student status" defaultValue={status ?? ""} name="status"><option value="">All statuses</option>{Object.values(StudentStatus).map((value) => <option key={value} value={value}>{studentStatusLabels[value]}</option>)}</select>
          <button className="secondary-button" type="submit">Apply filters</button>
          {(query || status) ? <Link className="text-link" href="/students">Clear</Link> : null}
        </form>

        {students.length ? (
          <div className="table-scroll room-table-wrap">
            <table className="data-table student-table">
              <thead><tr><th>Student</th><th>JKUAT details</th><th>Current room</th><th>Guardian</th><th>Date admitted</th><th>Status</th>{canManageStudents ? <th aria-label="Actions" /> : null}</tr></thead>
              <tbody>{students.map((student) => {
                const occupancy = student.occupancies[0];
                return (
                  <tr key={student.id}>
                    <td><strong>{student.fullName}</strong><a className="table-phone" href={`tel:${student.phone}`}><Phone size={11} />{student.phone}</a></td>
                    <td><strong>{student.admissionNumber || "Not provided"}</strong><small className="table-subtext">{student.university}</small></td>
                    <td>{occupancy ? <><strong>Room {occupancy.room.number}</strong><small className="table-subtext">{occupancy.semester.name}</small></> : <span className="muted-note">Not allocated</span>}</td>
                    <td>{student.guardian ? <><strong>{student.guardian.name}</strong><a className="table-phone" href={`tel:${student.guardian.phone}`}><Phone size={11} />{student.guardian.phone}</a></> : <span className="muted-note">Not provided</span>}</td>
                    <td>{new Intl.DateTimeFormat("en-KE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(student.admittedAt)}</td>
                    <td><span className={`status-pill ${studentStatusTone[student.status]}`}>{studentStatusLabels[student.status]}</span></td>
                    {canManageStudents ? <td><Link aria-label={`Edit ${student.fullName}`} className="table-action" href={`/students/${student.id}/edit`}><Pencil size={15} /> Edit</Link></td> : null}
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <div className="inline-empty"><GraduationCap size={25} /><strong>No students found</strong><p>Adjust the filters or add the first student record.</p></div>}
      </section>
    </div>
  );
}
