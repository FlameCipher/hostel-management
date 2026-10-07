"use client";
import { useActionState } from "react";
import {runInvitationAction} from "@/app/(app)/communications/invitations/actions";
export function InvitationRunForm(){const [state,action,pending]=useActionState(runInvitationAction,{});return <form action={action} className="entity-form"><button className="primary-button" disabled={pending}>{pending?"Sending invitations…":"Run enabled invitations now"}</button>{state.success?<p role="status" className="form-success">{state.success}</p>:null}{state.error?<p role="alert" className="form-error">{state.error}</p>:null}</form>}
