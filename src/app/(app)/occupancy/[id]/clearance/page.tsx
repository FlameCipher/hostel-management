import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { PrintReceiptButton } from "@/components/print-receipt-button";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function ClearancePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const occupancy = await db.occupancy.findFirst({ where: { id, organizationId: session.organizationId }, include: { organization: true, student: { include: { guardian: true } }, room: true, semester: true } });
  if (!occupancy) notFound();
  const finalPosition = Number(occupancy.finalBalance);
  return <div className="receipt-page"><div className="receipt-toolbar print-hidden"><Link className="secondary-button no-underline" href="/occupancy"><ArrowLeft size={17} /> Occupancy</Link><PrintReceiptButton label="Print clearance" /></div><article className="receipt-sheet"><header className="receipt-header"><span className="brand-mark"><Building2 size={21} /></span><div><h1>{occupancy.organization.name}</h1><p>Student room clearance</p></div><div className="receipt-number"><span>Clearance status</span><strong>{occupancy.clearanceStatus}</strong></div></header><div className="receipt-rule" /><section className="receipt-meta"><div><span>Student</span><strong>{occupancy.student.fullName}</strong><small>{occupancy.student.phone}</small></div><div><span>Room and semester</span><strong>Room {occupancy.room.number}</strong><small>{occupancy.semester.name}</small></div></section><section className="receipt-payment"><div><span>Checkout date</span><strong>{occupancy.checkedOutAt?.toLocaleDateString("en-KE", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }) ?? "Pending"}</strong></div><div><span>{finalPosition < 0 ? "Credit due to student" : "Final balance"}</span><strong>KES {Math.abs(finalPosition).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</strong></div></section><section className="receipt-details"><div><span>Guardian</span><strong>{occupancy.student.guardian?.name ?? "Not provided"}</strong></div><div><span>Guardian contact</span><strong>{occupancy.student.guardian?.phone ?? "Not provided"}</strong></div><div><span>Check-in condition</span><strong>{occupancy.checkInCondition ?? "Not recorded"}</strong></div><div><span>Checkout condition</span><strong>{occupancy.checkoutCondition ?? "Not recorded"}</strong></div></section><footer className="receipt-footer"><p>Cleared by: <strong>{session.name}</strong></p><p>{occupancy.organization.ownerName} · {occupancy.organization.phone}</p><small>This document records the student’s room checkout and financial position at clearance.</small></footer></article></div>;
}
