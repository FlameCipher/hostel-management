import { roundCurrency } from "./currency";
import { calculateMonthlyTransferRent } from "./monthly-transfer-rent";

export type HistoricalStay = {roomId:string;startDate:Date;endDate:Date|null;monthlyRate:number};
export type HistoricalAdjustment = {reason:string;calculationMethod:string;calculationData:unknown};
export type HistoricalCharge = {amount:number;currency:string;payments:{amount:number}[];adjustments:HistoricalAdjustment[]};

/** Strict read-only calculation used for both the owner's preview and the server action.
 * Never assumes that a payment is missing, and never changes a historical receipt.
 */
export function reconcileHistoricalTransfer(input:{
  semesterStart:Date;semesterEnd:Date;stays:HistoricalStay[];charges:HistoricalCharge[];
}) {
  const {semesterStart,semesterEnd}=input;
  const endOfMonth=new Date(Date.UTC(semesterEnd.getUTCFullYear(),semesterEnd.getUTCMonth()+1,0)).getUTCDate();
  if(semesterStart.getUTCDate()!==1||semesterEnd.getUTCDate()!==endOfMonth)throw Error("REVIEW_PARTIAL_SEMESTER");
  if(input.charges.length!==1)throw Error("REVIEW_MULTIPLE_CHARGES");
  const charge=input.charges[0];
  if(charge.adjustments.some(a=>a.reason!=="ROOM_TRANSFER"||a.calculationMethod!=="STANDARD_RATE"||!a.calculationData||typeof a.calculationData!=="object"||Array.isArray(a.calculationData)||!("method" in a.calculationData)||a.calculationData.method!=="MONTHLY"))throw Error("REVIEW_SPECIAL_ADJUSTMENTS");
  const stays=[...input.stays].sort((a,b)=>a.startDate.getTime()-b.startDate.getTime());
  if(stays.length<2||stays.filter(s=>s.endDate===null).length!==1||stays.at(-1)?.endDate!==null)throw Error("REVIEW_INCOMPLETE_ROOM_HISTORY");
  for(let i=0;i<stays.length-1;i++){
    if(!stays[i].endDate||stays[i].endDate!.getTime()!==stays[i+1].startDate.getTime())throw Error("REVIEW_ROOM_HISTORY_GAP");
  }
  const result=calculateMonthlyTransferRent({
    currency:charge.currency,firstMonth:semesterStart.toISOString().slice(0,7),lastMonth:semesterEnd.toISOString().slice(0,7),
    stays:stays.map(s=>({roomId:s.roomId,startDate:s.startDate,monthlyRate:s.monthlyRate})),
  });
  const paid=roundCurrency(charge.payments.reduce((sum,p)=>sum+p.amount,0),charge.currency);
  const recorded=roundCurrency(charge.amount,charge.currency);
  const delta=roundCurrency(result.total-recorded,charge.currency);
  return {lines:result.lines,expected:result.total,recorded,paid,delta,
    balance:Math.max(0,roundCurrency(result.total-paid,charge.currency)),
    credit:Math.max(0,roundCurrency(paid-result.total,charge.currency))};
}
