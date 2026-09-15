import Link from "next/link";
import { BedDouble, CreditCard, Search, Users } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { compareRooms } from "@/lib/natural-sort";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireSession();
  const { q: rawQuery } = await searchParams;
  const query = rawQuery?.trim() ?? "";
  const [students, rooms, payments] = query ? await Promise.all([
    db.student.findMany({ where: { organizationId: session.organizationId, OR: [{ fullName: { contains: query, mode: "insensitive" } }, { phone: { contains: query } }, { admissionNumber: { contains: query, mode: "insensitive" } }, { nationalId: { contains: query, mode: "insensitive" } }, { occupancies: { some: { status: "ACTIVE", room: { number: { contains: query, mode: "insensitive" } } } } }] }, include: { occupancies: { where: { status: "ACTIVE" }, select: { room: { select: { number: true } } }, take: 1 } }, orderBy: { fullName: "asc" }, take: 10 }),
    db.room.findMany({ where: { organizationId: session.organizationId, OR: [{ number: { contains: query, mode: "insensitive" } }, { floor: { contains: query, mode: "insensitive" } }, { roomType: { name: { contains: query, mode: "insensitive" } } }] }, include: { roomType: true }, take: 10 }),
    db.payment.findMany({ where: { organizationId: session.organizationId, OR: [{ receiptNumber: { contains: query, mode: "insensitive" } }, { reference: { contains: query, mode: "insensitive" } }, { student: { fullName: { contains: query, mode: "insensitive" } } }] }, include: { student: true }, orderBy: { paidAt: "desc" }, take: 10 }),
  ]) : [[], [], []];
  rooms.sort(compareRooms);
  const total = students.length + rooms.length + payments.length;

  return <div>
    <div className="page-heading-row"><div><p className="eyebrow">Quick search</p><h1>Search the hostel</h1><p>Find a student, room, receipt or payment reference.</p></div></div>
    <form action="/search" className="panel global-search-form" method="get" role="search"><Search size={20} /><input autoFocus defaultValue={query} name="q" placeholder="Name, phone, admission, ID, room or receipt" /><button className="primary-button" type="submit">Search</button></form>
    {!query ? <div className="inline-empty"><Search size={28} /><strong>Enter something to search</strong><p>You can search across student records, rooms and payments.</p></div> : total === 0 ? <div className="inline-empty"><Search size={28} /><strong>No matches for “{query}”</strong><p>Check the spelling or try a shorter search.</p></div> : <div className="search-results-grid">
      <section className="panel search-result-section"><div className="panel-heading"><div><p className="panel-kicker">People</p><h2>{students.length} student{students.length === 1 ? "" : "s"}</h2></div><Users size={19} /></div>{students.length ? <div className="search-result-list">{students.map((student) => <Link href={`/students/${student.id}/edit`} key={student.id}><strong>{student.fullName}</strong><span>{student.phone}{student.admissionNumber ? ` · ${student.admissionNumber}` : ""}{student.occupancies[0] ? ` · Room ${student.occupancies[0].room.number}` : ""}</span></Link>)}</div> : <p className="muted-note">No matching students.</p>}</section>
      <section className="panel search-result-section"><div className="panel-heading"><div><p className="panel-kicker">Accommodation</p><h2>{rooms.length} room{rooms.length === 1 ? "" : "s"}</h2></div><BedDouble size={19} /></div>{rooms.length ? <div className="search-result-list">{rooms.map((room) => <Link href={`/rooms/${room.id}/edit`} key={room.id}><strong>Room {room.number}</strong><span>{room.floor || "Floor not set"} · {room.roomType.name}</span></Link>)}</div> : <p className="muted-note">No matching rooms.</p>}</section>
      <section className="panel search-result-section"><div className="panel-heading"><div><p className="panel-kicker">Transactions</p><h2>{payments.length} payment{payments.length === 1 ? "" : "s"}</h2></div><CreditCard size={19} /></div>{payments.length ? <div className="search-result-list">{payments.map((payment) => <Link href={`/payments/${payment.id}/receipt`} key={payment.id}><strong>{payment.receiptNumber}</strong><span>{payment.student.fullName} · KES {Number(payment.amount).toLocaleString("en-KE")}{payment.reference ? ` · ${payment.reference}` : ""}</span></Link>)}</div> : <p className="muted-note">No matching payments.</p>}</section>
    </div>}
  </div>;
}
