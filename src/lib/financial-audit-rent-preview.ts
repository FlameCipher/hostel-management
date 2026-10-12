import { calculateMonthlyTransferRent } from "./monthly-transfer-rent";
import { roundCurrency } from "./currency";
import type { FinancialAuditOccupancy } from "./financial-integrity-audit";

/** Two illustrative, read-only billing policies for a changed-rate transfer.
 * Neither policy is assumed to govern the student's signed agreement.
 * Owner/Admin must confirm the actual treatment separately.
 */
export function possibleTransferRentTreatments(
  row: FinancialAuditOccupancy,
  semesterStart: Date,
  semesterEnd: Date,
) {
  if (row.charges.length !== 1 || row.stays.length < 2 ||
      row.charges[0].adjustments.length !== 0) return null;

  const stays=[...row.stays].sort((a,b)=>a.startDate.getTime()-b.startDate.getTime());
  const newRoom=stays.at(-1);
  if (!newRoom || newRoom.roomId!==row.roomId || newRoom.endDate !== null ||
      !Number.isFinite(newRoom.semesterRate) || newRoom.semesterRate<=0) return null;
  const prices=new Set(stays.map((stay)=>stay.monthlyRate));
  if(prices.size<=1) return null;

  const charge=row.charges[0];
  const paid=roundCurrency(charge.payments.reduce((sum,p)=>sum+p.amount,0),charge.currency);
  try {
    const monthly=calculateMonthlyTransferRent({
      currency:charge.currency,
      firstMonth:semesterStart.toISOString().slice(0,7),
      lastMonth:semesterEnd.toISOString().slice(0,7),
      stays:stays.map((stay)=>({
        roomId:stay.roomId,startDate:stay.startDate,monthlyRate:stay.monthlyRate,
      })),
    });
    const destinationSemesterTotal=roundCurrency(newRoom.semesterRate,charge.currency);
    return {
      monthly:{
        total:monthly.total,
        balance:roundCurrency(monthly.total-paid,charge.currency),
        lines:monthly.lines.map((line)=>({
          month:line.month,roomNumber:stays.find((stay)=>stay.roomId===line.roomId)?.roomNumber??"—",
          rate:line.rate,
        })),
      },
      destinationSemester:{
        total:destinationSemesterTotal,
        balance:roundCurrency(destinationSemesterTotal-paid,charge.currency),
      },
      recordedRent:roundCurrency(charge.amount,charge.currency),
      recordedBalance:roundCurrency(charge.amount-paid,charge.currency),
      paid,currency:charge.currency,
    };
  } catch {
    return null;
  }
}
