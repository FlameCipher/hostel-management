import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { formatMoney, minorUnits } from "@/lib/currency";
import { resolveFinanceWindow } from "@/lib/assistant-management-intents";
import type { FinancePeriod } from "@/lib/assistant-finance-period";

export function namedStudentAccountIntent(question:string): {name:string}|null {
 const q=question.trim().replace(/[?!.\s]+$/g,"");
 if(!q||q.length>1200||/\broom\s*(?:number\s*)?\d+/i.test(q))return null;
 const patterns=[
   /\bhow much\s+(?:has|did|does)\s+(.+?)\s+(?:paid|pay|owe)\b/i,
   /\b(?:what(?:'s| is)|show(?: me)?|check|tell me)\s+(.+?)(?:'s|’s)\s+(?:balance|payments?|rent|arrears)\b/i,
   /\b(?:balance|payments?|rent|arrears|receipts?)\s+(?:of|for)\s+(.+)$/i,
   /\b(?:show|list|find)\s+(?:payments?|rent|balance)\s+for\s+(.+)$/i,
 ];
 const match=patterns.map(p=>q.match(p)).find(Boolean);
 if(!match)return null;
 const name=match[1].replace(/^(?:student|tenant|resident)\s+/i,"")
   .replace(/\s+(?:this|current|last|previous)\s+(?:month|week|year|semester)\b.*$/i,"")
   .replace(/\s+(?:today|yesterday)\b.*$/i,"")
   .replace(/\s+(?:in|during|for)\s+(?:20\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)\b.*$/i,"")
   .trim();
 if(name.length<2||name.length>80||!/^[\p{L}][\p{L}\p{M}\s.'’\-]{1,79}$/u.test(name))return null;
 return {name};
}
export function isPrivateFinanceQuestion(question:string) {
 return /\b(?:payments?|paid|paying|collections?|collected|receive(?:d|s)?|receipts?|balances?|outstanding|debts?|debtors?|arrears|rent|invoices?|owe|owed|owing|m-pesa|mpesa|deni|madeni|amelipa)\b/i.test(question);
}
type FinanceLink={title:string;href:string;action:string};
const link=(title:string,href:string,action:string):FinanceLink=>({title,href,action});
export async function namedStudentAccountAnswer(db:PrismaClient,
 session:Pick<SessionPayload,"organizationId"|"role">,name:string,
 period:FinancePeriod={kind:"all",label:"All recorded periods"}
) {
 if(session.role==="CARETAKER")return {mode:"records" as const,text:"Individual payment records require authorized management finance access.",links:[link("Rooms","/rooms","Open rooms")]};
 const organizationId=session.organizationId;
 const [org,students]=await Promise.all([
  db.organization.findFirst({where:{id:organizationId,status:"ACTIVE"},select:{currency:true}}),
  db.student.findMany({where:{organizationId,fullName:{contains:name,mode:"insensitive"}},
   select:{id:true,fullName:true,occupancies:{where:{organizationId,status:{in:["ACTIVE","RESERVED"]}},select:{room:{select:{number:true}}},take:3}},take:3})
 ]);
 if(!org)return {mode:"records" as const,text:"Hostel finance settings are unavailable. Sign in again.",links:[]};
 if(!students.length)return {mode:"records" as const,text:"I could not find a student matching '"+name+"' in your hostel. Check the registered name; no other hostel was searched.",links:[link("Payments","/payments","Search payment register")]};
 if(students.length>1)return {mode:"records" as const,text:"More than one hostel student matches '"+name+"': "+students.map(s=>s.fullName).join("; ")+". Use the protected payment register to choose the exact student; no figures were guessed.",links:[link("Payments","/payments?q="+encodeURIComponent(name),"Select student")]};
 const s=students[0],currency=org.currency;
 const window=await resolveFinanceWindow(db,organizationId,period);
 if(window&&"error" in window)return {mode:"records" as const,text:window.error+" I have not substituted an all-time payment total.",links:[link("Semesters","/semesters","Review periods")]};
 const [charges,payments]=await Promise.all([
  db.charge.findMany({where:{organizationId,studentId:s.id,status:{not:"WAIVED"}},select:{
   studentId:true,organizationId:true,currency:true,amount:true,semesterId:true,
   payments:{where:{reversedAt:null},select:{amount:true,currency:true,studentId:true,organizationId:true}}
  },take:10001}),
  db.payment.findMany({where:{organizationId,studentId:s.id,reversedAt:null,...(window?{paidAt:{gte:window.start,lt:window.end}}:{})},
   select:{amount:true,currency:true,studentId:true,organizationId:true,charge:{select:{studentId:true,organizationId:true}}},take:10001})
 ]);
 if(charges.length>10000||payments.length>10000)return {mode:"records" as const,text:"The selected student's ledger has too many entries for this short response. Use the detailed register; no incomplete sum was shown.",links:[link("Payments","/payments?q="+encodeURIComponent(s.fullName),"Open full register")]};
 if(charges.some(c=>c.currency!==currency||c.studentId!==s.id||c.organizationId!==organizationId||c.payments.some(p=>p.currency!==currency||p.studentId!==s.id||p.organizationId!==organizationId))||
   payments.some(p=>p.currency!==currency||p.studentId!==s.id||p.organizationId!==organizationId||p.charge.studentId!==s.id||p.charge.organizationId!==organizationId))
  return {mode:"records" as const,text:"A student/payment identity or currency mismatch was found. No financial amount was shown. Please review the financial integrity register.",links:[link("Financial integrity","/payments/audit","Review ledger")]};
 const factor=minorUnits(1,currency);
 let chargeMinor=0,paidTowardsCharges=0,outstandingMinor=0;
 const applicable=window?.semesterId?charges.filter(c=>c.semesterId===window.semesterId):charges;
 for(const c of applicable){
  const amt=minorUnits(Number(c.amount),currency),paid=c.payments.reduce((total,p)=>total+minorUnits(Number(p.amount),currency),0);
  if(paid>amt)return {mode:"records" as const,text:"An overpayment requires financial integrity review before a current balance can be confirmed.",links:[link("Financial integrity","/payments/audit","Review ledger")]};
  chargeMinor+=amt;paidTowardsCharges+=paid;outstandingMinor+=Math.max(0,amt-paid);
 }
 const receiptMinor=payments.reduce((total,p)=>total+minorUnits(Number(p.amount),currency),0);
 const money=(n:number)=>formatMoney(n/factor,currency);
 const rooms=[...new Set(s.occupancies.map(o=>o.room.number))];
 const roomLabel=rooms.length===1?"Current registered room "+rooms[0]:rooms.length>1?"Multiple current registered allocations":"No current registered room";
 const allLabel=window?.semesterId?"Outstanding on that semester's charges":"Outstanding across all recorded non-waived charges";
 const payLabel=window?"Payments received during "+window.label:"All recorded unreversed payments";
 const text=[
  s.fullName+" — "+roomLabel,
  payLabel+": "+money(receiptMinor)+" ("+payments.length+" payment records)",
  "Charged toward "+(window?.semesterId?window.label:"all recorded non-waived periods")+": "+money(chargeMinor),
  "Payments applied to those charges (all receipt dates): "+money(paidTowardsCharges),
  allLabel+": "+money(outstandingMinor),
  "Payment dates and charge/semester dates are distinct. These are recorded hostel ledger entries, not an independent bank confirmation. No records were changed."
 ].join("\n");
 return {mode:"records" as const,text,links:[link("Payments","/payments?q="+encodeURIComponent(s.fullName),"Verify receipts")]};
}
