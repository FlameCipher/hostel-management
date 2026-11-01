"use client";
import { useActionState } from "react";
import { paymentAgreementAction } from "@/app/(app)/reports/arrears/actions";
import styles from "./arrears-form.module.css";
export function PaymentAgreementForm({ student }: { student: { id: string; name: string; date: string; note: string; updatedAt: string } }) {
  const [state, action, pending] = useActionState(paymentAgreementAction, {});
  return <section className={styles.tenant}><h2>Agreed payment date · {student.name}</h2><form action={action} className={styles.form}>
    <input type="hidden" name="studentId" value={student.id}/><input type="hidden" name="expectedUpdatedAt" value={student.updatedAt}/>
    <label className={styles.search}>Agreed date<input type="date" name="date" defaultValue={student.date}/></label>
    <label className={styles.search}>Agreement / reason<textarea name="note" defaultValue={student.note} minLength={5} maxLength={500} required placeholder="Record what was agreed with the student"/></label>
    <p>Demands are paused through this date. The rent balance stays unchanged. Follow-ups can resume the following day if rent remains overdue.</p>
    <label className={styles.agreementCheck}><input type="checkbox" name="confirmed" required/>I confirm management approved this arrangement or its removal.</label>
    <div className={styles.selection}><button className={styles.primary} name="operation" value="save" disabled={pending}>Save agreed date</button>{student.date && <button name="operation" value="clear" disabled={pending}>Clear agreement</button>}</div>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}{state.success && <p role="status" className={styles.success}>{state.success}</p>}
  </form></section>;
}
