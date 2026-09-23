"use client";

import { FormSelect } from "@/components/form-select";
import { RoomPhotoUploader } from "@/components/room-photo-uploader";
import { RoomPhotoUploader } from "@/components/room-photo-uploader";
import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import { createRoomAction, updateRoomAction, type RoomFormState } from "@/app/(app)/rooms/actions";
import { roomStatusLabels } from "@/lib/rooms";

type RoomTypeOption = {
  id: string;
  name: string;
  sharingMode: "PRIVATE" | "SHARED";
  defaultCapacity: number;
  monthlyRate: number;
  semesterRate: number;
};

type RoomDefaults = {
  id: string;
  number: string;
  roomTypeId: string;
  floor: string;
  capacityOverride: number | null;
  status: "VACANT" | "PARTIALLY_OCCUPIED" | "FULL" | "MAINTENANCE" | "INACTIVE";
  notes: string;
  photos?: Array<{ type: "INSIDE" | "OUTSIDE" | "COMPOUND"; url: string; pathname: string | null }>;
};

const initialState: RoomFormState = { error: "" };

export function RoomForm({ roomTypes, room }: { roomTypes: RoomTypeOption[]; room?: RoomDefaults }) {
  const action = room ? updateRoomAction.bind(null, room.id) : createRoomAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="panel entity-form">
      <div className="form-section-heading"><div><p className="panel-kicker">Room details</p><h2>{room ? `Edit room ${room.number}` : "Create a room"}</h2></div><p>Fields marked with * are required.</p></div>

      <div className="form-grid">
        <label className="field-group"><span>Room number *</span><input defaultValue={room?.number} maxLength={20} name="number" placeholder="e.g. 12 or B04" required /></label>
        <label className="field-group"><span>Floor *</span><input defaultValue={room?.floor} maxLength={40} name="floor" placeholder="e.g. Ground" required /><small>Room numbers must be unique within this floor.</small></label>
        <label className="field-group form-span-2"><span>Accommodation type *</span><FormSelect defaultValue={room?.roomTypeId ?? ""} name="roomTypeId" required><option disabled value="">Select room type</option>{roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name} · {type.sharingMode === "PRIVATE" ? "Private" : "Shared"} · KES {type.semesterRate.toLocaleString("en-KE")}/semester</option>)}</FormSelect><small>Capacity and rent default to the selected accommodation type.</small></label>
        <label className="field-group"><span>Capacity override</span><input defaultValue={room?.capacityOverride ?? ""} max={20} min={1} name="capacityOverride" placeholder="Use type default" type="number" /><small>Leave blank unless this room has a different capacity.</small></label>
        <label className="field-group"><span>Availability status *</span><FormSelect defaultValue={room?.status ?? "VACANT"} name="status">{(["VACANT", "PARTIALLY_OCCUPIED", "FULL", "MAINTENANCE", "INACTIVE"] as const).map((status) => <option key={status} value={status}>{roomStatusLabels[status]}</option>)}</FormSelect><small>Occupancy statuses are recalculated from active allocations.</small></label>
        <RoomPhotoUploader defaults={Object.fromEntries((room?.photos ?? []).map((photo) => [photo.type.toLowerCase(), { url: photo.url, pathname: photo.pathname ?? undefined }]))} />
        <RoomPhotoUploader defaults={Object.fromEntries((room?.photos ?? []).map((photo) => [photo.type.toLowerCase(), { url: photo.url, pathname: photo.pathname ?? undefined }]))} />
        <label className="field-group form-span-2"><span>Notes</span><textarea defaultValue={room?.notes} maxLength={500} name="notes" placeholder="Optional maintenance, access or room notes" rows={4} /></label>
      </div>

      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}

      <div className="form-actions">
        <Link className="secondary-button no-underline" href="/rooms"><ArrowLeft size={17} /> Cancel</Link>
        <button className="primary-button" disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={17} />}{room ? "Save changes" : "Add room"}</button>
      </div>
    </form>
  );
}
