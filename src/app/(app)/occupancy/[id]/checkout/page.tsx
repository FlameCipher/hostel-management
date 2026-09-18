import { notFound, redirect } from "next/navigation";
import { CheckoutInspectionForm } from "@/components/checkout-inspection-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/occupancy");
  const { id } = await params;
  const occupancy = await db.occupancy.findFirst({
    where: { id, organizationId: session.organizationId, status: "ACTIVE" },
    include: {
      student: true,
      semester: true,
      propertyItems: true,
      roomStays: { orderBy: { startDate: "asc" } },
      charges: { where: { type: "SEMESTER_RENT" }, include: { payments: { where: { reversedAt: null } } }, orderBy: { createdAt: "asc" }, take: 1 },
      room: { include: { roomType: true, assets: { where: { active: true } } } },
    },
  });
  if (!occupancy) notFound();
  const rentCharge = occupancy.charges[0];
  const stays = occupancy.roomStays.length ? occupancy.roomStays : [{ startDate: occupancy.checkInAt, endDate: null, semesterRateSnapshot: occupancy.room.roomType.semesterRate }];
  return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Checkout and clearance</p><h1>Check out {occupancy.student.fullName}</h1><p>Room {occupancy.room.number}. Review rent, balances and all recorded items before clearance.</p></div></div><CheckoutInspectionForm occupancyId={id} allowOverride={["OWNER", "ADMIN"].includes(session.role)} propertyItems={occupancy.propertyItems.map((item) => ({ id: item.id, name: item.name, checkInCondition: item.checkInCondition }))} assets={occupancy.room.assets.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity }))} semesterStart={occupancy.semester.startDate.toISOString().slice(0, 10)} semesterEnd={occupancy.semester.endDate.toISOString().slice(0, 10)} currentRent={Number(rentCharge?.amount ?? 0)} rentPaid={rentCharge?.payments.reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0} stays={stays.map((stay) => ({ startDate: stay.startDate.toISOString(), endDate: stay.endDate?.toISOString() ?? null, semesterRate: Number(stay.semesterRateSnapshot) }))} /></div>;
}
