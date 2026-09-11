import { notFound, redirect } from "next/navigation";

import { DeleteRoomForm } from "@/components/delete-room-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function DeleteRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/rooms");
  const { id } = await params;

  const room = await db.room.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      _count: {
        select: {
          occupancies: true,
          breakReservations: true,
          assets: true,
        },
      },
    },
  });

  if (!room) notFound();

  const canDelete = room._count.occupancies === 0 && room._count.breakReservations === 0;
  const roomLabel = `Room ${room.number} · ${room.floor || "Floor not set"}`;

  return (
    <div className="form-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Room register</p>
          <h1>Delete room</h1>
          <p>
            {room._count.assets
              ? `${room._count.assets} asset record${room._count.assets === 1 ? " is" : "s are"} currently assigned to this room.`
              : "No hostel assets are assigned to this room."}
          </p>
        </div>
      </div>
      <DeleteRoomForm roomId={room.id} roomLabel={roomLabel} canDelete={canDelete} />
    </div>
  );
}
