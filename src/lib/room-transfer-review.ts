import { createHash } from "node:crypto";
import { calculateMonthlyTransferRent } from "@/lib/monthly-transfer-rent";
import { roundCurrency } from "@/lib/currency";

export type TransferRoomStay = {
  id: string; roomId: string; roomNumber: string; roomTypeId: string;
  roomTypeName: string;
  startDate: Date; endDate: Date | null;
  monthlyRate: number; semesterRate: number;
};
export type TransferRentCharge = {
  id: string; amount: number; baseAmount: number | null;
  currency: string; status: string; roomTypeId: string | null;
  description: string;
  payments: {amount: number; currency: string; studentId: string; organizationId: string}[];
  adjustments: {reason: string; calculationMethod: string; explanation?: string}[];
};
export type TransferReviewRecord = {
  organizationId: string; id: string; studentId: string;
  status: string; roomId: string; currentRoom: string; roomTypeId: string;
  semesterName: string; semesterStart: Date; semesterEnd: Date;
  studentName: string;
  stays: TransferRoomStay[];
  charges: TransferRentCharge[];
};
export type TransferFlag = {code: string; level:"critical"|"review"|"info"; detail:string};

export function transferReviewFingerprint(row: TransferReviewRecord) {
  const sorted = [...row.stays].sort((a,b)=>a.startDate.getTime()-b.startDate.getTime());
  return createHash("sha256").update(JSON.stringify([
    row.organizationId,row.id,row.studentId,row.status,row.roomId,row.roomTypeId,
    row.semesterStart.toISOString(),row.semesterEnd.toISOString(),
    sorted.map(s=>[s.id,s.roomId,s.roomTypeId,s.startDate.toISOString(),
      s.endDate?.toISOString()??null,s.monthlyRate,s.semesterRate]),
    [...row.charges].sort((a,b)=>a.id.localeCompare(b.id)).map(c=>[
      c.id,c.amount,c.baseAmount,c.currency,c.status,c.roomTypeId,c.description,
      c.payments.map(p=>[p.studentId,p.organizationId,p.currency,p.amount])
        .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
      c.adjustments.map(a=>[a.reason,a.calculationMethod,a.explanation??""])
        .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
    ]),
  ])).digest("hex");
}

/** Pure, read-only analysis. Recorded stay dates are not proof of physical presence.
 * Monthly/destination calculations are alternative illustrations, not instructions
 * to change a tenant's signed full-semester rent agreement.
 */
export function reviewRoomTransfers(row:TransferReviewRecord){
  const stays=[...row.stays].sort((a,b)=>a.startDate.getTime()-b.startDate.getTime());
  const flags:TransferFlag[]=[];
  const flag=(code:string,level:TransferFlag["level"],detail:string)=>{
    flags.push({code,level,detail});
  };
  if(stays.length===0) flag("STAY_HISTORY_MISSING","critical","No room-stay records exist.");
  const open=stays.filter(s=>s.endDate===null);
  if(row.status==="ACTIVE" && (open.length!==1 || open[0].roomId!==row.roomId)) {
    flag("ACTIVE_STAY_MISMATCH","critical","The current room is not the single open room-stay record.");
  }
  if(stays.some((s,i)=>
    !Number.isFinite(s.startDate.getTime()) ||
    (s.endDate!==null && (Number.isNaN(s.endDate.getTime()) ||
       s.endDate.getTime()<=s.startDate.getTime())) ||
    (i>0 && stays[i-1].endDate?.getTime()!==s.startDate.getTime())
  )) flag("INVALID_STAY_TIMELINE","critical","Recorded stays overlap, have gaps, or contain invalid dates.");
  if(stays.some(s=>s.startDate>row.semesterEnd ||
     (s.endDate!==null && s.endDate>new Date(row.semesterEnd.getTime()+86_400_000)))) {
    flag("OUT_OF_SEMESTER_STAY","review","A recorded stay falls outside the relevant semester.");
  }
  if(stays.some(s=>!Number.isFinite(s.monthlyRate)||s.monthlyRate<0 ||
    !Number.isFinite(s.semesterRate)||s.semesterRate<0)){
    flag("INVALID_RATE_SNAPSHOT","critical","A recorded room rate is invalid.");
  }

  const charge=row.charges.length===1?row.charges[0]:null;
  if(row.charges.length!==1)flag("RENT_CHARGE_COUNT","critical","Review missing or duplicate semester rent charges.");
  let paid=0,balance=0,monthly:null|ReturnType<typeof calculateMonthlyTransferRent>=null;
  let destination:null|{rent:number;balance:number}=null;
  let ownerOverride=false;
  if(charge){
    paid=roundCurrency(charge.payments.reduce((sum,p)=>sum+p.amount,0),charge.currency);
    balance=roundCurrency(charge.amount-paid,charge.currency);
    ownerOverride=charge.adjustments.some(a=>
      a.calculationMethod==="CUSTOM"||a.reason==="RATE_CORRECTION");
    if(charge.payments.some(p=>p.studentId!==row.studentId ||
       p.organizationId!==row.organizationId || p.currency!==charge.currency || p.amount<=0)) {
      flag("PAYMENT_LINKAGE","critical","A payment has the wrong student, hostel, currency, or amount.");
    }
    if(charge.roomTypeId!==row.roomTypeId)
      flag("RENT_ROOM_TYPE_MISMATCH","review","The recorded charge room type differs from the active room type.");
    if(paid>charge.amount)
      flag("OVERPAYMENT","review","Active payments exceed the recorded rent.");
    if(ownerOverride)
      flag("OWNER_OVERRIDE_PRESERVED","info","An owner-approved adjustment exists. Do not replace it with a calculated alternative.");
    const oldRoom=charge.description.match(/\bRoom\s+([A-Za-z0-9-]+)/i)?.[1];
    if(oldRoom && oldRoom.toLocaleLowerCase()!==row.currentRoom.toLocaleLowerCase()){
      flag("OLD_ROOM_LABEL","info","The charge description still mentions an earlier room.");
    }
    if(stays.length>1 && stays.every(s=>Number.isFinite(s.monthlyRate)&&s.monthlyRate>=0)
      && Number.isFinite(row.semesterStart.getTime())&&Number.isFinite(row.semesterEnd.getTime())){
      try {
        monthly=calculateMonthlyTransferRent({
          currency:charge.currency,
          firstMonth:row.semesterStart.toISOString().slice(0,7),
          lastMonth:row.semesterEnd.toISOString().slice(0,7),
          stays:stays.map(s=>({roomId:s.roomId,startDate:s.startDate,monthlyRate:s.monthlyRate})),
        });
      } catch { flag("MONTHLY_PREVIEW_UNAVAILABLE","review","Calendar-month scenario cannot be calculated safely."); }
      const last=stays.at(-1)!;
      destination={rent:roundCurrency(last.semesterRate,charge.currency),
        balance:roundCurrency(last.semesterRate-paid,charge.currency)};
    }
  }
  return {
    flags,
    stays,
    paid,
    balance,
    monthly: monthly?{...monthly,balance:roundCurrency(monthly.total-paid,charge!.currency)}:null,
    destination,
    ownerOverride,
    recordedRent:charge?.amount??null,
    currency:charge?.currency??null,
    transferCount:Math.max(0,stays.length-1),
    fingerprint:transferReviewFingerprint(row),
  };
}
