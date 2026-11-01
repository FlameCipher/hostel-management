"use client";
import {useTransition} from "react";
import {openMessageAction} from "@/app/(app)/communications/whatsapp/actions";
export function OpenMessageButton({id}:{id:string}) {
 const [pending,startTransition]=useTransition();
 return <button className="secondary-button" type="button" disabled={pending} onClick={()=>startTransition(()=>openMessageAction(id))}>{pending?"Opening…":"Open this recipient’s WhatsApp"}</button>;
}
