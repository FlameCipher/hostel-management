"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

import {
  deleteRoomAction,
  type DeleteRoomState,
} from "@/app/(app)/rooms/actions";

const initialState: DeleteRoomState = { error: "" };

export function DeleteRoomForm({
  roomId,
  roomLabel,
  canDelete,
}: {
  roomId: string;
  roomLabel: string;
  canDelete: boolean;
}) {
  const action = deleteRoomAction.bind(null, roomId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="panel entity-form">
      <div className="form-section-heading">
        <div>
          <p className="panel-kicker">Permanent deletion</p>
          <h2>Delete {roomLabel}</h2>
          <p>
            This removes the room from the register. Any hostel assets assigned to it
            will remain in the asset register and become unassigned.
          </p>
        </div>
      </div>

      <div className="form-grid">
        <div className="warning-callout form-span-2">
          <Trash2 size={18} />
          <div>
            <strong>{canDelete ? "This action cannot be undone." : "This room cannot be deleted."}</strong>
            <p>
              {canDelete
                ? "Confirm only if this room was created by mistake."
                : "It has allocation or break-reservation history. Set its status to Inactive instead so historical records remain accurate."}
            </p>
          </div>
        </div>
      </div>

      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}

      <div className="form-actions">
        <Link className="secondary-button no-underline" href="/rooms">Cancel</Link>
        {canDelete ? (
          <button className="danger-button" disabled={pending} type="submit">
            {pending ? <LoaderCircle className="animate-spin" size={17} /> : <Trash2 size={17} />}
            Delete room permanently
          </button>
        ) : null}
      </div>
    </form>
  );
}
