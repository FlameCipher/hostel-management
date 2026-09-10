import { redirect } from "next/navigation";
import { RoomForm } from "@/components/room-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function NewRoomPage() {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/rooms");

  const roomTypes = await db.roomType.findMany({
    where: { organizationId: session.organizationId, active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="form-page">
      <div className="page-heading-row"><div><p className="eyebrow">Room register</p><h1>Add a room</h1><p>Create a room and assign its accommodation rate and capacity.</p></div></div>
      <RoomForm roomTypes={roomTypes.map((type) => ({ ...type, monthlyRate: Number(type.monthlyRate), semesterRate: Number(type.semesterRate) }))} />
    </div>
  );
}
