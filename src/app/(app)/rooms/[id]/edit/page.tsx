import { notFound, redirect } from "next/navigation";
import { RoomForm } from "@/components/room-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function EditRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/rooms");
  const { id } = await params;

  const [room, roomTypes] = await Promise.all([
    db.room.findFirst({ where: { id, organizationId: session.organizationId }, include: { photos: true } }),
    db.roomType.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!room) notFound();

  return (
    <div className="form-page">
      <div className="page-heading-row"><div><p className="eyebrow">Room register</p><h1>Edit room {room.number}</h1><p>Update this room’s accommodation, capacity and availability.</p></div></div>
      <RoomForm
        room={{ id: room.id, number: room.number, roomTypeId: room.roomTypeId, floor: room.floor ?? "", capacityOverride: room.capacityOverride, status: room.status, notes: room.notes ?? "", photos: room.photos }}
        roomTypes={roomTypes.map((type) => ({ ...type, monthlyRate: Number(type.monthlyRate), semesterRate: Number(type.semesterRate) }))}
      />
    </div>
  );
}
