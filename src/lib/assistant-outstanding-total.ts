import type {PrismaClient} from "@/generated/prisma/client";
import type {FinancePeriod} from "@/lib/assistant-finance-period";
import {resolveFinanceWindow} from "@/lib/assistant-management-intents";
import {minorUnits,formatMoney} from "@/lib/currency";

const link=(title:string,href:string,action:string)=>({title,href,action});
/** Read-only exact outstanding amounts, never collections or a bank balance. */
export async function answerOutstandingTotal(
 db:PrismaClient,organizationId:string,period:FinancePeriod
) {
 const org=await db.organization.findUnique({where:{id:organizationId},select:{currency:true}});
 if(!org)return {mode:"records" as const,text:"Hostel finance settings are unavailable.",links:[]};
 const window=await resolveFinanceWindow(db,organizationId,period);
 if(window&&"error" in window)return {mode:"records" as const,text:window.error+" No all-time total was substituted.",links:[link("Semesters","/semesters","Review semesters")]};
 const where={
  organizationId,status:{not:"WAIVED" as const},
  ...(window?.semesterId?{semesterId:window.semesterId}:window?{dueDate:{gte:window.start,lt:window.end}}:{})
 };
 const charges=await db.charge.findMany({where,select:{
  amount:true,currency:true,organizationId:true,studentId:true,
  payments:{where:{reversedAt:null},select:{amount:true,currency:true,organizationId:true,studentId:true}}
 },take:10001});
 if(charges.length>10000)return {mode:"records" as const,text:"More than 10,000 charges match the request; a partial total would be misleading. Narrow the period or open the payment register.",links:[link("Payments","/payments?view=outstanding","Open all")]};
 const currency=org.currency;
 if(charges.some(c=>c.currency!==currency||c.organizationId!==organizationId||c.payments.some(p=>p.currency!==currency||p.organizationId!==organizationId||p.studentId!==c.studentId)))
  return {mode:"records" as const,text:"The ledger has a payment identity or currency discrepancy. I cannot safely calculate the balance until it is reviewed.",links:[link("Financial review","/payments/audit","Review ledger")]};
 let total=0,unpaidCount=0;
 const students=new Set<string>();
 for(const charge of charges) {
  const due=minorUnits(Number(charge.amount),currency);
  const paid=charge.payments.reduce((n,p)=>n+minorUnits(Number(p.amount),currency),0);
  if(paid>due)return {mode:"records" as const,text:"A charge has an overpayment that requires financial review. I have not substituted a misleading net total.",links:[link("Financial review","/payments/audit","Review ledger")]};
  const remaining=due-paid;
  if(remaining>0){total+=remaining;unpaidCount++;students.add(charge.studentId);}
 }
 const fmt=formatMoney(total/minorUnits(1,currency),currency);
 const scope=window?(window.semesterId?"for "+window.label:"on charges due during "+window.label):"across all recorded non-waived charges and semesters";
 return {mode:"records" as const,
  text:"Total outstanding hostel balance "+scope+": "+fmt+
  "\n"+students.size+" students have "+unpaidCount+" unpaid or partly paid charges."+
  "\nThis is money still owed according to the hostel ledger, NOT money collected and NOT the bank/M-Pesa account balance."+
  (window&&!window.semesterId?" Charges are selected by due date; payments applied to them may have been received on different dates.":"")+
  "\nNo records were changed.",
  links:[link("Outstanding register","/payments?view=outstanding","Review outstanding charges")]
 };
}
