"use client";

import { useId, useRef, useState } from "react";
import { BedDouble, Check, ChevronDown, Search, X } from "lucide-react";
import "./room-selector.css";

export type AllocationRoomOption = {
  id: string;
  number: string;
  floor: string | null;
  type: string;
  capacity: number;
  occupied: number;
  rate: number;
};

export function RoomSelector({ rooms }: { rooms: AllocationRoomOption[] }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const validation = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [invalid, setInvalid] = useState(false);
  const selected = rooms.find((room) => room.id === value);
  const visible = rooms.filter((room) => `Room ${room.number} ${room.floor ?? ""} ${room.type}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }) || (a.floor ?? "").localeCompare(b.floor ?? ""));
  const money = (rate: number) => `KES ${rate.toLocaleString("en-KE")}`;

  function open() {
    setQuery("");
    dialog.current?.showModal();
  }

  return <div className="field-group form-span-2 allocation-room-field">
    <span id={`${id}-label`}>Available room *</span>
    <input name="roomId" type="hidden" value={selected?.id ?? ""} />
    <input className="room-required-input" ref={validation} tabIndex={-1} aria-hidden="true" required value={selected?.id ?? ""} onChange={() => {}} onInvalid={(event) => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); }} />
    <button ref={trigger} type="button" className="room-picker-trigger" aria-haspopup="dialog" aria-labelledby={`${id}-label ${id}-value`} aria-describedby={`${id}-help`} data-invalid={invalid} onClick={open}>
      <BedDouble size={21} />
      <span id={`${id}-value`}><strong>{selected ? `Room ${selected.number}` : "Choose an available room"}</strong><small>{selected ? `${selected.floor || "Floor unspecified"} · ${selected.type} · ${money(selected.rate)}/semester` : `${rooms.length} rooms to choose from`}</small></span>
      <ChevronDown size={18} />
    </button>
    <small id={`${id}-help`}>The room must match the accommodation type selected during registration.</small>
    {invalid && !selected ? <p className="form-error" role="alert">Choose a room before completing allocation.</p> : null}
    <dialog ref={dialog} className="room-picker-dialog" aria-labelledby={`${id}-title`} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="room-picker-content">
        <header><div><p>ROOM ALLOCATION</p><h2 id={`${id}-title`}>Choose a room</h2><small>Find the right room for this student.</small></div><button type="button" aria-label="Close room selector" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
        <div className="room-picker-search"><Search size={18} /><input autoFocus type="search" aria-label="Search by room number, floor or type" placeholder="Search room number or floor…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <p className="room-picker-count" role="status">{visible.length} {visible.length === 1 ? "room" : "rooms"} available</p>
        <div className="room-picker-list">
          {visible.map((room) => <button type="button" key={room.id} className={`room-picker-option ${value === room.id ? "is-selected" : ""}`} aria-pressed={value === room.id} onClick={() => { setValue(room.id); setInvalid(false); validation.current?.setCustomValidity(""); dialog.current?.close(); }}>
            <span className="room-picker-bed"><BedDouble size={20} /></span>
            <span className="room-picker-details"><strong>Room {room.number}</strong><span>{room.floor || "Floor unspecified"} · {room.type}</span><small>{Math.max(0, room.capacity - room.occupied)} of {room.capacity} beds available</small></span>
            <span className="room-picker-price"><strong>{money(room.rate)}</strong><small>per semester</small>{value === room.id ? <Check size={18} aria-label="Selected" /> : null}</span>
          </button>)}
          {!visible.length ? <div className="room-picker-empty"><Search size={24} /><strong>No rooms found</strong><p>Try a different room number or floor.</p></div> : null}
        </div>
        <footer>Select a room to return to the allocation form.</footer>
      </div>
    </dialog>
  </div>;
}
