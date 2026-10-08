"use client";
import { useActionState } from "react";
import { repairAction } from "@/app/(app)/healthfix/actions";
export function HealthfixRepairForm() {
  const [state, action, pending] = useActionState(repairAction, {});
  return <form action={action} className="entity-form"><button className="primary-button" disabled={pending}>{pending ? "Running safe repairs…" : "Run safe repairs"}</button>{state.success ? <p role="status" className="form-success">{state.success}</p> : null}{state.error ? <p role="alert" className="form-error">{state.error}</p> : null}</form>;
}
