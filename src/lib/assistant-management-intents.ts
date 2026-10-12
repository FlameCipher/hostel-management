import type { PrismaClient } from "@/generated/prisma/client";
import { formatMoney, minorUnits } from "@/lib/currency";

export type ManagementIntent = {kind:"debtors";month:string|null} | {kind:"collected";month:string|null} | {kind:"register"} | {kind:"payment"} | null;
const monthNames=["january","february","march","april","may","june","july","august","september","october","november","december"];

export function financialMonthFromQuestion(question:string):string|null {
  const numeric=question.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if(numeric)return numeric[0];
  const word=monthNames.findIndex(name=>new RegExp(`\\b${name}\\b`,"i").test(question));
  if(word<0)return null;
  const year=question.match(/\b20\d{2}\b/)?.[0]??String(new Date().getUTCFullYear());
  return `${year}-${String(word+1).padStart(2,"0")}`;
}
export function managementIntent(question:string):ManagementIntent {
  const q=question.trim().toLocaleLowerCase("en");
  if(!q||q.length>1200)return null;
  const month=financialMonthFromQuestion(q);
  if(/\b(?:who|which|show|list|find|tell|give|report|calculate|total|how much|what|nani|onyesha)\b/.test(q)&&
      /(?:\b(?:unpaid|outstanding|debtor(?:s)?|arrears|owing|owe|owed|balances? due|not paid|hasn.t paid|haven.t paid)\b|\bmadeni\b|\bdeni\b|\bhajalipa\b)/.test(q))return {kind:"debtors",month};
  if(/(?:\b(?:how much|total|sum|collected|received|collection|paid to us|money in)\b|makusanyo)/.test(q) &&
      /\b(?:collected|received|payment|rent|money|income|collection|paid|total|how much)\b/.test(q))return {kind:"collected",month};
  if(/^(?:please\s+)?(?:add|register|enrol|enroll|create)(?:\s+new)?\s+(?:a\s+|this\s+)?(?:student|tenant|resident)\b/.test(q))return {kind:"register"};
  if(/^(?:please\s+)?(?:record|add|post|enter|allocate|register)\s+(?:a\s+|this\s+|new\s+)?(?:payment|rent payment|mpesa payment|bank payment|cash payment)\b/.test(q))return {kind:"payment"};
  return null;
}

type LedgerRow={id:string;studentId:string;studentName:string;rooms:string[];currency:string;amount:number;payments:{amount:number;currency:string;organizationId:string;studentId:string}[]};
export function summarizeUnpaidRows(rows:LedgerRow[],currency:string,month:string|null,observedAt:Date){
  const byStudent=new Map<string,{name:string;rooms:Set<string>;amountMinor:number;charges:number}>();
  let totalMinor=0,unpaidCharges=0;
  for(const row of rows){
    if(row.currency!==currency||row.payments.some(p=>p.currency!==currency||p.studentId!==row.studentId))
      return {text:"The ledger includes a currency or student-payment mismatch. For safety, no totals have been produced. Review Financial integrity before relying on the figures.",inconsistent:true};
    const paid=row.payments.reduce((sum,p)=>sum+minorUnits(p.amount,currency),0);
    const balance=Math.max(0,minorUnits(row.amount,currency)-paid);
    if(!balance)continue;
    unpaidCharges++;totalMinor+=balance;
    const item=byStudent.get(row.studentId)??{name:row.studentName,rooms:new Set<string>(),amountMinor:0,charges:0};
    item.amountMinor+=balance;item.charges++;row.rooms.forEach(r=>item.rooms.add(r));byStudent.set(row.studentId,item);
  }
  const students=[...byStudent.values()].sort((a,b)=>b.amountMinor-a.amountMinor||a.name.localeCompare(b.name));
  const amount=(n:number)=>formatMoney(n/10**(currency==="KES"?2:2),currency);
  // Amount formatter is currency-generic; use a known decimal precision from the registry.
  const precision=minorUnits(1,currency);
  const fmt=(n:number)=>formatMoney(n/precision,currency);
  const scope=month?`Charges due in ${month}`:"All recorded non-waived charges (all semesters)";
  const header=`${scope}, as of ${new Intl.DateTimeFormat("en-KE",{timeZone:"Africa/Nairobi",dateStyle:"medium",timeStyle:"short"}).format(observedAt)}.\n${students.length} students owe ${fmt(totalMinor)} across ${unpaidCharges} outstanding charges.`;
  const lines=students.slice(0,30).map((s,i)=>`${i+1}. ${s.name}${s.rooms.size===1?` (Room ${[...s.rooms][0]})`:""} — ${fmt(s.amountMinor)}`);
  const trailing=students.length>30?`\nShowing the first 30 of ${students.length} students; open Payments for the full register.`:"";
  return {text:[header,...lines].join("\n")+trailing,inconsistent:false};
}

export async function managementLedgerAnswer(db:PrismaClient,organizationId:string,kind:"debtors"|"collected",month:string|null) {
  const org=await db.organization.findUnique({where:{id:organizationId},select:{currency:true}});
  if(!org)return {text:"Hostel financial records are unavailable. Sign in again.",links:[]};
  const currency=org.currency;
  const bounds=month?{gte:new Date(`${month}-01T00:00:00.000Z`),lt:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1))}:null;
  if(kind==="collected"){
    const where={organizationId,reversedAt:null,...(bounds?{paidAt:bounds}:{})};
    const count=await db.payment.count({where});
    if(count>10000)return {text:"Too many payment records to summarize safely. Use the finance reports for the full period.",links:[{title:"Payment reports",href:"/reports",action:"Open reports"}]};
    const records=await db.payment.findMany({where,select:{amount:true,currency:true,charge:{select:{studentId:true,organizationId:true}},studentId:true},take:10001});
    if(records.some(r=>r.currency!==currency||r.charge.organizationId!==organizationId||r.studentId!==r.charge.studentId))return {text:"A payment linkage or currency discrepancy needs financial review.",links:[{title:"Financial integrity",href:"/payments/audit",action:"Review"}]};
    const sum=records.reduce((total,p)=>total+minorUnits(Number(p.amount),currency),0);
    const decimal=minorUnits(1,currency);
    const heading=month?`Payments received in ${month}`:"All recorded unreversed payments";
    return {text:`${heading}: ${formatMoney(sum/decimal,currency)} across ${count} payment records. These are ledger receipts, not a bank reconciliation. No records were changed.`,links:[{title:"Payments",href:"/payments",action:"Open payment register"}]};
  }
  const where={organizationId,status:{not:"WAIVED" as const},...(bounds?{dueDate:bounds}:{})};
  const count=await db.charge.count({where});
  const href=month?`/payments?view=outstanding&month=${month}`:"/payments?view=outstanding";
  if(count>10000)return {text:"Too many charges for a complete conversational summary. Open Payments for the full register.",links:[{title:"Outstanding payments",href,action:"Open all"}]};
  const records=await db.charge.findMany({where,select:{id:true,studentId:true,organizationId:true,currency:true,amount:true,student:{select:{fullName:true,occupancies:{where:{status:"ACTIVE",organizationId},select:{room:{select:{number:true}}},take:2}}},payments:{where:{reversedAt:null},select:{amount:true,currency:true,organizationId:true,studentId:true}}},take:10001});
  if(records.some(r=>r.organizationId!==organizationId||r.payments.some(p=>p.organizationId!==organizationId)))return {text:"A hostel-scope mismatch needs financial review before showing debtor balances.",links:[{title:"Financial integrity",href:"/payments/audit",action:"Review"}]};
  const rows:LedgerRow[]=records.map(r=>({id:r.id,studentId:r.studentId,studentName:r.student.fullName,currency:r.currency,amount:Number(r.amount),rooms:r.student.occupancies.map(x=>x.room.number),payments:r.payments.map(p=>({amount:Number(p.amount),currency:p.currency,studentId:p.studentId,organizationId:p.organizationId}))}));
  const result=summarizeUnpaidRows(rows,currency,month,new Date());
  return {text:result.text,links:result.inconsistent?[{title:"Financial integrity",href:"/payments/audit",action:"Review"}]:[{title:"Outstanding payments",href,action:"Open detailed balances"}]};
}
