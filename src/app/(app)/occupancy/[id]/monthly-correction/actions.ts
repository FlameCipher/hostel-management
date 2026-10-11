"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { residentStaff } from "@/lib/resident-access";
import { db } from "@/lib/db";
import { applyChargeAmount } from "@/lib/rent-calculation";
import { reconcileHistoricalTransfer } from "@/lib/monthly-rent-reconciliation";

export type HistoricalCorrectionState = {error:string;success:string};
export async function approveHistoricalRentCorrection(
  occupancyId:string, _state:HistoricalCorrectionState, formData:FormData,
):Promise<HistoricalCorrectionState> {
  const session=await requireSession();
  if (formData.get("confirmed")!=="on") return {error:"Review and confirm the correction first.",success:""};
  const chargeId=formData.get("chargeId");
  const expectedRent=Number(formData.get("expectedRent"));
  if(typeof chargeId!=="string"||!chargeId||!Number.isFinite(expectedRent)||expectedRent<=0) return {error:"Reload the financial review.",success:""};
  try {
    const result=await db.$transaction(async(tx)=>{
      const user=await residentStaff(tx,session,true);
      if(!user||!["OWNER","ADMIN"].includes(user.role))throw Error("NOT_AUTHORIZED");
      const occupancy=await tx.occupancy.findFirst({
        where:{id:occupancyId,organizationId:session.organizationId,status:"ACTIVE"},
        include:{
          semester:true,
          roomStays:{orderBy:{startDate:"asc"}},
          charges:{where:{type:"SEMESTER_RENT"},include:{
            adjustments:{select:{reason:true,calculationMethod:true,calculationData:true}},
            payments:{where:{reversedAt:null},select:{amount:true}},
          }},
        },
      });
      if(!occupancy||occupancy.charges.length!==1||occupancy.charges[0].id!==chargeId)throw Error("STALE_RECORD");
      const charge=occupancy.charges[0];
      const preview=reconcileHistoricalTransfer({
        semesterStart:occupancy.semester.startDate,semesterEnd:occupancy.semester.endDate,
        stays:occupancy.roomStays.map(stay=>({roomId:stay.roomId,startDate:stay.startDate,endDate:stay.endDate,monthlyRate:Number(stay.monthlyRateSnapshot)})),
        charges:[{amount:Number(charge.amount),currency:charge.currency,status:charge.status,payments:charge.payments.map(p=>({amount:Number(p.amount)})),
          adjustments:charge.adjustments.map(a=>({reason:a.reason,calculationMethod:a.calculationMethod,calculationData:a.calculationData}))}],
      });
      if(preview.expected!==expectedRent)throw Error("PREVIEW_CHANGED");
      if(preview.delta===0)return {changed:false,balance:preview.balance,credit:preview.credit};
      const adjustment=await applyChargeAmount(tx,{
        organizationId:session.organizationId,chargeId:charge.id,createdById:session.userId,
        reason:"RATE_CORRECTION",calculationMethod:"STANDARD_RATE",newAmount:preview.expected,
        effectiveDate:occupancy.roomStays.at(-1)?.startDate??new Date(),
        explanation:"Owner-approved calendar-month room-transfer rent reconciliation",
        calculationData:{method:"HISTORICAL_MONTHLY_CORRECTION",monthlyLines:preview.lines,recordedRent:preview.recorded,paid:preview.paid},
      });
      await tx.auditLog.create({data:{
        organizationId:session.organizationId,actorUserId:session.userId,
        action:"HISTORICAL_ROOM_RENT_RECONCILED",entityType:"Charge",entityId:charge.id,
        metadata:{occupancyId:occupancy.id,previousRent:preview.recorded,correctedRent:preview.expected,paid:preview.paid,balance:adjustment.balance,credit:adjustment.credit},
      }});
      return {changed:adjustment.changed,balance:adjustment.balance,credit:adjustment.credit};
    },{isolationLevel:"Serializable"});
    revalidatePath(`/occupancy/${occupancyId}`);
    revalidatePath("/payments");
    revalidatePath("/dashboard");
    return {error:"",success:result.changed?"Audited rent correction saved. The updated balance is now available in the student ledger.":"The rent already matches the verified monthly calculation."};
  } catch(error){
    const code=error instanceof Error?error.message:"";
    if(code==="NOT_AUTHORIZED")return {error:"Only an active Owner or Admin can approve a rent correction.",success:""};
    if(code==="STALE_RECORD"||code==="PREVIEW_CHANGED")return {error:"The student's financial records have changed. Reload and review the new figures.",success:""};
    if(code.startsWith("REVIEW_")||code==="MISSING_MONTH_RATE"||code==="INVALID_STAYS")return {error:"This student's room history or financial adjustments need manual review. No changes were made.",success:""};
    return {error:"The correction could not be saved safely. Reload and try again; no change is confirmed.",success:""};
  }
}
