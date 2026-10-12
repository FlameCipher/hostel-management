/** Reject malformed transfer histories for EVERY rent method, not only
 * calendar-month transfers. This prevents zero/negative active stay periods,
 * postdated/backdated records and price snapshots being silently rewritten.
 */
export function validateTransferPreflight(input:{
  occupancyRoomId:string;
  occupancyCheckIn:Date;
  semesterEnd:Date;
  transferDate:Date;
  stays:Array<{roomId:string;startDate:Date;endDate:Date|null}>;
  chargeCount:number;
  chargeCurrency:string;
  originalRoomCurrency:string;
  destinationRoomCurrency:string;
  rentMethod:string;
  originalMonthlyRate:number;
  destinationMonthlyRate:number;
  originalSemesterRate:number;
  destinationSemesterRate:number;
}){
  if(input.chargeCount!==1)throw Error("TRANSFER_CHARGE_REVIEW_REQUIRED");
  if(input.chargeCurrency!==input.originalRoomCurrency ||
     input.chargeCurrency!==input.destinationRoomCurrency) {
    throw Error("TRANSFER_CURRENCY_REVIEW_REQUIRED");
  }
  if(!Number.isFinite(input.transferDate.getTime()) ||
     input.transferDate<=input.occupancyCheckIn ||
     input.transferDate>input.semesterEnd)throw Error("INVALID_TRANSFER_DATE");
  const stays=[...input.stays].sort((a,b)=>a.startDate.getTime()-b.startDate.getTime());
  if(stays.length){
    const open=stays.filter(s=>s.endDate===null);
    if(open.length!==1||open[0].roomId!==input.occupancyRoomId ||
       input.transferDate<=open[0].startDate ||
       stays.some((s,i)=>!Number.isFinite(s.startDate.getTime()) ||
         (s.endDate!==null&&(s.endDate<=s.startDate ||
           !Number.isFinite(s.endDate.getTime()))) ||
         (i>0&&stays[i-1].endDate?.getTime()!==s.startDate.getTime()))) {
      throw Error("TRANSFER_HISTORY_REVIEW_REQUIRED");
    }
  }
  if(input.rentMethod==="KEEP_FULL" &&
     (input.originalMonthlyRate!==input.destinationMonthlyRate ||
      input.originalSemesterRate!==input.destinationSemesterRate)) {
    throw Error("RENT_RECALC_REQUIRED");
  }
  return true;
}
