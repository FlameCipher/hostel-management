import { roundCurrency } from "./currency";

export type MonthlyRoomStay = {
  roomId: string;
  startDate: Date;
  monthlyRate: number;
};

/** Month-based billing: a room change takes effect from its selected billing month.
 * Previous months retain their original rate. Dates are interpreted in UTC.
 * This is a pure preview calculator; it never changes financial records.
 */
export function calculateMonthlyTransferRent(input: {
  currency: string;
  firstMonth: string;
  lastMonth: string;
  stays: MonthlyRoomStay[];
}) {
  const parseMonth = (value: string) => {
    if (!/^\\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw Error("INVALID_MONTH");
    return Number(value.slice(0,4))*12+Number(value.slice(5,7))-1;
  };
  const first=parseMonth(input.firstMonth), last=parseMonth(input.lastMonth);
  if (last<first || last-first>23) throw Error("INVALID_MONTH_RANGE");
  const stays=[...input.stays].sort((a,b)=>a.startDate.getTime()-b.startDate.getTime());
  if (!stays.length || stays.some(s=>!Number.isFinite(s.monthlyRate)||s.monthlyRate<0||Number.isNaN(s.startDate.getTime()))) throw Error("INVALID_STAYS");
  const lines=[] as {month:string;roomId:string;rate:number}[];
  for(let m=first;m<=last;m++){
    const year=Math.floor(m/12), month=m%12+1;
    const period=`${year}-${String(month).padStart(2,"0")}`;
    const active=stays.filter(s=>s.startDate.getUTCFullYear()*12+s.startDate.getUTCMonth()<=m).at(-1);
    if(!active) throw Error("MISSING_MONTH_RATE");
    lines.push({month:period,roomId:active.roomId,rate:roundCurrency(active.monthlyRate,input.currency)});
  }
  return {lines,total:roundCurrency(lines.reduce((sum,line)=>sum+line.rate,0),input.currency)};
}
