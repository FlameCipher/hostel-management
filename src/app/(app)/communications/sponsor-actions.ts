"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { prepareSponsorMessage } from "@/lib/sponsor-messages";
import { readMessageDelivery } from "@/lib/message-delivery";
import type { CommunicationState } from "./actions";
export async function sponsorMessageAction(_state:CommunicationState,form:FormData):Promise<CommunicationState> {
 const session=await requireSession();
 try {
  const result=await prepareSponsorMessage(db,session,Object.fromEntries(["requestId","studentId","name","phone","kind","title","body","fingerprint"].map(key=>[key,String(form.get(key)??"")])));
  revalidatePath("/communications");revalidatePath("/communications/whatsapp");
  if("reportId" in result && result.reportId) return {...result,report:(await readMessageDelivery(db,session.organizationId,result.reportId))??undefined};
  return result;
 } catch {return {error:"The draft could not be confirmed. Check message history before retrying."};}
}
