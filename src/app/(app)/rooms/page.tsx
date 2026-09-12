import { FormSelect } from "@/components/form-select";
import Link from "next/link";
import { BedDouble, Building2, DoorOpen, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { RoomStatus, type RoomStatus as RoomStatusType } from "@/generated/prisma/enums";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getEffectiveRoomStatus, roomStatusLabels, roomStatusTone } from "@/lib/rooms";

type RoomsPageProps = {
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
};

const validStatuses = new Set<string>(Object.values(RoomStatus));

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function RoomsPage({ searchParams }: RoomsPageProps) {
  const session = await requireSession();
  const filters = await searchParams;
  const query = filters.q?.trim() ?? "";
  const status = validStatuses.has(filters.status ?? "")
    ? (filters.status as RoomStatusType)
    : undefined;
  const roomTypeId = filters.type?.trim() || undefined;
  const canManageRooms = session.role !== "CARETAKER";

  const [roomTypes, rooms, allRooms] = await Promise.all([
    db.roomType.findMany({
      where: { organizationId: session.organizationId, active: true },
      orderBy: [{ name: "asc" }],
    }),
    db.room.findMany({
      where: {
        organizationId: session.organizationId,
        ...(query ? { number: { contains: query, mode: "insensitive" } } : {}),
        ...(status ? { status } : {}),
        ...(roomTypeId ? { roomTypeId } : {}),
      },
      include: {
        roomType: true,
        occupancies: {
          where: { status: "ACTIVE" },
          select: { id: true, studentId: true, student: { select: { fullName: true } } },
          orderBy: { checkInAt: "asc" },
        },
        breakReservations: {
          where: { status: "RESERVED_FREE" },
          select: { id: true, studentId: true, student: { select: { fullName: true } } },
        },
      },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    }),
    db.room.findMany({
      where: { organizationId: session.organizationId },
      select: {
        status: true,
        capacityOverride: true,
        roomType: { select: { defaultCapacity: true } },
        occupancies: { where: { status: "ACTIVE" }, select: { studentId: true } },
        breakReservations: { where: { status: "RESERVED_FREE" }, select: { studentId: true } },
      },
    }),
  ]);

  const summary = allRooms.reduce(
    (totals, room) => {
      const capacity = room.capacityOverride ?? room.roomType.defaultCapacity;
      const heldSpaces = new Set([...room.occupancies.map((item) => item.studentId), ...room.breakReservations.map((item) => item.studentId)]).size;
      const effectiveStatus = getEffectiveRoomStatus(room.status, heldSpaces, capacity);
      totals.total += 1;
      if (effectiveStatus === "VACANT") totals.vacant += 1;
      if (effectiveStatus === "FULL") totals.full += 1;
      if (effectiveStatus === "PARTIALLY_OCCUPIED") totals.partial += 1;
      return totals;
    },
    { total: 0, vacant: 0, full: 0, partial: 0 },
  );

  return (
    <div>
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Accommodation management</p>
          <h1>Rooms</h1>
          <p>Manage room types, capacity, rent rates and live occupancy.</p>
        </div>
        {canManageRooms ? (
          <Link className="primary-button no-underline" href="/rooms/new">
            <Plus size={18} /> Add room
          </Link>
        ) : null}
      </div>

      <section className="room-summary-grid" aria-label="Room summary">
        <article className="compact-stat"><span className="metric-icon metric-blue"><Building2 size={22} /></span><div><p>Total rooms</p><strong>{summary.total}</strong></div></article>
        <article className="compact-stat"><span className="metric-icon metric-sky"><DoorOpen size={22} /></span><div><p>Vacant</p><strong>{summary.vacant}</strong></div></article>
        <article className="compact-stat"><span className="metric-icon metric-violet"><Users size={22} /></span><div><p>Part occupied</p><strong>{summary.partial}</strong></div></article>
        <article className="compact-stat"><span className="metric-icon metric-green"><BedDouble size={22} /></span><div><p>Full</p><strong>{summary.full}</strong></div></article>
      </section>

      <section className="panel mt-5">
        <div className="panel-heading">
          <div><p className="panel-kicker">Configured pricing</p><h2>Accommodation rates</h2></div>
          <span className="muted-note">4-month semester</span>
        </div>
        <div className="rate-grid">
          {roomTypes.map((type) => (
            <article className="rate-card" key={type.id}>
              <div><strong>{type.name}</strong><span>{type.sharingMode === "PRIVATE" ? "Private" : "Shared"} · Capacity {type.defaultCapacity}</span></div>
              <div className="rate-values"><span>{formatCurrency(Number(type.monthlyRate))}<small>/month</small></span><strong>{formatCurrency(Number(type.semesterRate))}<small>/semester</small></strong></div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mt-5 overflow-hidden">
        <div className="panel-heading room-list-heading">
          <div><p className="panel-kicker">Room register</p><h2>{rooms.length} matching room{rooms.length === 1 ? "" : "s"}</h2></div>
        </div>

        <form className="filter-bar" method="get">
          <label className="filter-search">
            <Search size={17} />
            <input defaultValue={query} name="q" placeholder="Search room number" />
          </label>
          <FormSelect aria-label="Filter by room type" defaultValue={roomTypeId ?? ""} name="type">
            <option value="">All room types</option>
            {roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </FormSelect>
          <FormSelect aria-label="Filter by room status" defaultValue={status ?? ""} name="status">
            <option value="">All statuses</option>
            {Object.values(RoomStatus).map((value) => <option key={value} value={value}>{roomStatusLabels[value]}</option>)}
          </FormSelect>
          <button className="secondary-button" type="submit">Apply filters</button>
          {(query || status || roomTypeId) ? <Link className="text-link" href="/rooms">Clear</Link> : null}
        </form>

        {rooms.length ? (
          <div className="table-scroll room-table-wrap">
            <table className="data-table room-table">
              <thead><tr><th>Room</th><th>Accommodation</th><th>Capacity</th><th>Current occupants</th><th>Semester rent</th><th>Status</th>{canManageRooms ? <th aria-label="Actions" /> : null}</tr></thead>
              <tbody>
                {rooms.map((room) => {
                  const capacity = room.capacityOverride ?? room.roomType.defaultCapacity;
                  const heldStudentIds = new Set([...room.occupancies.map((item) => item.studentId), ...room.breakReservations.map((item) => item.studentId)]);
                  const occupantCount = heldStudentIds.size;
                  const effectiveStatus = getEffectiveRoomStatus(room.status, occupantCount, capacity);
                  const activeStudentIds = new Set(room.occupancies.map((item) => item.studentId));
                  const breakOnlyReservations = room.breakReservations.filter((item) => !activeStudentIds.has(item.studentId));
                  return (
                    <tr key={room.id}>
                      <td><strong>Room {room.number}</strong><small className="table-subtext">{room.floor || "Floor not set"}</small></td>
                      <td><strong>{room.roomType.name}</strong><small className="table-subtext">{room.roomType.sharingMode === "PRIVATE" ? "Private" : "Shared"}</small></td>
                      <td>{occupantCount} / {capacity}</td>
                      <td>{room.occupancies.length || breakOnlyReservations.length ? <>{room.occupancies.map((occupancy) => occupancy.student.fullName).join(", ")}{room.occupancies.length && breakOnlyReservations.length ? "; " : ""}{breakOnlyReservations.map((reservation) => `${reservation.student.fullName} (break reserved)`).join(", ")}</> : <span className="muted-note">No occupants</span>}</td>
                      <td><strong>{formatCurrency(Number(room.roomType.semesterRate))}</strong><small className="table-subtext">per person</small></td>
                      <td><span className={`status-pill ${roomStatusTone[effectiveStatus]}`}>{roomStatusLabels[effectiveStatus]}</span></td>
                      {canManageRooms ? <td><div className="row-actions room-row-actions"><Link aria-label={`Edit room ${room.number}`} className="table-action" href={`/rooms/${room.id}/edit`}><Pencil size={15} /> Edit</Link><Link aria-label={`Delete room ${room.number}`} className="room-delete-button" href={`/rooms/${room.id}/delete`} title={`Delete Room ${room.number} · ${room.floor || "Floor unspecified"}`}><Trash2 size={14} /> Delete</Link></div></td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="inline-empty"><DoorOpen size={25} /><strong>No rooms found</strong><p>Adjust the filters or add a new room to the register.</p></div>
        )}
      </section>
    </div>
  );
}
