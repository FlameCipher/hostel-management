"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import "./form-select.css";

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

type Props = {
  children: ReactNode;
  name: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
};

function optionText(node: ReactNode): string {
  return Children.toArray(node).map((child) => isValidElement<{ children?: ReactNode }>(child) ? optionText(child.props.children) : String(child)).join("");
}

export function FormSelect({ children, name, defaultValue, required, disabled, "aria-label": ariaLabel }: Props) {
  const id = useId();
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const [value, setValue] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [invalid, setInvalid] = useState(false);
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string; disabled?: boolean; children?: ReactNode }>(child) || child.type !== "option") return [];
    return [{ value: child.props.value ?? optionText(child.props.children), label: optionText(child.props.children), disabled: child.props.disabled }];
  });
  const initialValue = defaultValue ?? options[0]?.value ?? "";
  const currentValue = value ?? initialValue;
  const selected = options.find((option) => option.value === currentValue);
  const searchable = ["roomId", "targetRoomId", "studentId", "targetStudentId", "occupancyId", "chargeId", "paymentId"].includes(name) || options.length > 8;
  const title = ariaLabel ?? ({ roomId: "Room", targetRoomId: "New room", studentId: "Student", occupancyId: "Student and room", chargeId: "Outstanding charge", paymentId: "Payment" }[name] ?? name.replace(/Id$/, "").replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase()));
  const visible = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const form = native.current?.form;
    const reset = () => { setValue(null); setInvalid(false); setQuery(""); dialog.current?.close(); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);

  return <span className="form-select-container">
    <select ref={native} className={mounted ? "form-select-native" : undefined} name={name} value={currentValue} required={required} disabled={disabled} tabIndex={mounted ? -1 : undefined} aria-hidden={mounted || undefined} aria-label={title} onChange={(event) => { setValue(event.target.value); setInvalid(false); }} onInvalid={(event) => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); }}>
      {children}
    </select>
    {mounted ? <button ref={trigger} className="form-select-trigger" type="button" disabled={disabled} aria-haspopup="dialog" aria-label={`${title}: ${selected?.label ?? "Choose an option"}`} data-invalid={invalid} onClick={() => { setQuery(""); dialog.current?.showModal(); }}><span>{selected?.label ?? "Choose an option"}</span><ChevronDown size={17} /></button> : null}
    {invalid ? <span className="form-select-error" role="alert">Please select {title.toLowerCase()}.</span> : null}
    {mounted ? createPortal(<dialog ref={dialog} className="form-select-dialog" aria-labelledby={`${id}-title`} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="form-select-panel">
        <header><div><p>SELECT AN OPTION</p><h2 id={`${id}-title`}>{title}</h2></div><button autoFocus={!searchable} type="button" aria-label="Close selection" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
        {searchable ? <div className="form-select-search"><Search size={18} /><input autoFocus type="search" aria-label={`Search ${title.toLowerCase()}`} placeholder={`Search ${title.toLowerCase()}…`} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); dialog.current?.querySelector<HTMLButtonElement>('.form-select-option:not(:disabled)')?.focus(); } }} /></div> : null}
        <p className="form-select-count" role="status">{visible.length} {visible.length === 1 ? "option" : "options"}</p>
        <div className="form-select-list">{visible.map((option) => <button key={option.value} type="button" disabled={option.disabled} className={`form-select-option ${currentValue === option.value ? "is-selected" : ""}`} aria-pressed={currentValue === option.value} onClick={() => { setValue(option.value); setInvalid(Boolean(required && !option.value)); dialog.current?.close(); trigger.current?.focus(); }}><span>{option.label}</span>{currentValue === option.value ? <Check size={18} /> : null}</button>)}
          {!visible.length ? <div className="form-select-empty"><Search size={24} /><strong>No matches found</strong><p>Try a different name or room number.</p></div> : null}
        </div>
      </div>
    </dialog>, document.body) : null}
  </span>;
}
