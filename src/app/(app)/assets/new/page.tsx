import { redirect } from "next/navigation";
import { AssetForm } from "@/components/asset-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { compareRooms } from "@/lib/natural-sort";
export default async function NewAssetPage() { const session = await requireSession(); if (session.role === "CARETAKER") redirect("/assets"); const rooms = await db.room.findMany({ where: { organizationId: session.organizationId }, orderBy: { number: "asc" } }); rooms.sort(compareRooms); return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Hostel inventory</p><h1>Add asset</h1></div></div><AssetForm rooms={rooms.map((room) => ({ id: room.id, label: `Room ${room.number} · ${room.floor || "Floor unspecified"}` }))} /></div>; }
