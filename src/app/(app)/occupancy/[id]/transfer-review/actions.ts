"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { recordTransferEvidenceNote } from "@/lib/room-transfer-evidence";

export type TransferEvidenceState={error:string;success:string};

export async function submitTransferEvidenceAction(
  occupancyId:string,_state:TransferEvidenceState,formData:FormData,
):Promise<TransferEvidenceState>{
  const session=await requireSession();
  if(formData.get("acknowledged")!=="on"){
    return {error:"Confirm that this note is a claim or reference, not independently verified evidence.",success:""};
  }
  const data={
    occupancyId,
    fingerprint:formData.get("fingerprint"),
    requestId:formData.get("requestId"),
    noteType:formData.get("noteType"),
    note:formData.get("note"),
    evidenceReference:formData.get("evidenceReference")??"",
    reportedPhysicalMoveDate:formData.get("reportedPhysicalMoveDate")??"",
  };
  try{
    const result=await recordTransferEvidenceNote(db,session,data);
    revalidatePath("/occupancy/transfers");
    revalidatePath("/payments/audit");
    revalidatePath("/occupancy/"+encodeURIComponent(occupancyId));
    revalidatePath("/occupancy/"+encodeURIComponent(occupancyId)+"/transfer-review");
    return result.created
      ?{error:"",success:"Your observation was recorded in the audit log. Recorded stay dates, payments and rent were not changed."}
      :{error:"",success:"This exact submission is already in the audit log. No duplicate record was created."};
  }catch(error){
    const code=error instanceof Error?error.message:"";
    if(code==="NOT_AUTHORIZED")
      return {error:"Only an active Owner or Admin can record review notes.",success:""};
    if(code==="REVIEW_STALE")
      return {error:"Room history or ledger changed during review. Reload this page before recording a note.",success:""};
    if(code==="TRANSFER_CASE_UNAVAILABLE")
      return {error:"That transfer is unavailable or belongs to another hostel.",success:""};
    if(code==="INVALID_REVIEW_NOTE")
      return {error:"Choose a note type, enter at least 20 characters, and check any date or reference.",success:""};
    return {error:"The note could not be confirmed. Check the audit history before trying again.",success:""};
  }
}
