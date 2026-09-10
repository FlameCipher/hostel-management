"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { createReminderAction, type ReminderState } from "@/app/(app)/notifications/actions";

const initial: ReminderState = { error: "" };
type Option = { id: string; label: string };

export function ReminderForm({ students, whatsappEnabled, smsEnabled }: { students: Option[]; whatsappEnabled: boolean; smsEnabled: boolean }) {
  const [state, action, pending] = useActionState(createReminderAction, initial);
  const noChannels = !whatsappEnabled && !smsEnabled;
  return <form action={action} className="panel entity-form"><div className="form-section-heading"><div><p className="panel-kicker">Manual delivery queue</p><h2>Compose reminder</h2></div></div><div className="form-grid"><label className="field-group form-span-2"><span>Student *</span><select name="studentId" required><option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}</select></label><label className="field-group"><span>Send to *</span><select name="recipientType"><option value="STUDENT">Student</option><option value="GUARDIAN">Parent/guardian</option></select></label><label className="field-group"><span>Channel *</span><select name="channel" required><option value="">Select enabled channel</option>{whatsappEnabled ? <option value="WHATSAPP">WhatsApp</option> : null}{smsEnabled ? <option value="SMS">SMS</option> : null}</select>{noChannels ? <small>Enable a reminder channel in Settings first.</small> : null}</label><label className="field-group form-span-2"><span>Message *</span><textarea defaultValue="Hello, this is a reminder from Mama Mbugua Hostel regarding your outstanding accommodation balance. Please contact us for assistance. Thank you." maxLength={1000} name="message" rows={5} required /></label></div><p className="policy-note">The reminder is queued first. Opening it launches your device’s WhatsApp or SMS composer; mark it sent only after confirming delivery.</p>{state.error ? <p className="form-error">{state.error}</p> : null}<div className="form-actions"><button className="primary-button" disabled={pending || noChannels}><Send size={17} /> Queue reminder</button></div></form>;
}
