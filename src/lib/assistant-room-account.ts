import type { PrismaClient } from "@/generated/prisma/client";
import { formatMoney, minorUnits } from "@/lib/currency";
import type { SessionPayload } from "@/lib/auth/session";
import type { FinancePeriod } from "@/lib/assistant-finance-period";
import { resolveFinanceWindow } from "@/lib/assistant-management-intents";

export function roomAccountIntent(question: string): { number: string } | null {
  if (!question.trim() || question.length > 1200) return null;
  const match = question.match(/\broom\s*(?:number\s*)?([0-9]{1,5}[a-z]?)\b/i);
  if (!match) return null;
  // A specific room plus a financial question always outranks the all-hostel
  // "how much was collected" classifier. No numerical records are inferred.
  if (!/(?:how much|how many|payments?|paid|pay\b|balance|balances|rent|owing|owed|arrears|receipts?|received|statement|transactions?|amelipa|kalipa)/i.test(question)) return null;
  return { number: match[1].toUpperCase() };
}

type RecordLink = { title: string; href: string; action: string };
type AccountAnswer = { mode: "records"; text: string; links: RecordLink[] };
const link = (title:string,href:string,action:string):RecordLink => ({title,href,action});

export async function answerRoomAccount(
  db: PrismaClient, session: Pick<SessionPayload,"organizationId"|"role">, number:string,
  period:FinancePeriod={kind:"all",label:"All recorded periods"}
): Promise<AccountAnswer> {
  // Defense in depth: never allow gate-only users to see money.
  if (session.role === "CARETAKER") return {
    mode:"records",text:"You can verify room allocations, but payment information requires management finance access.",
    links:[link("Room register","/rooms","Open rooms")]
  };
  const organizationId = session.organizationId;
  const [organization, rooms] = await Promise.all([
    db.organization.findFirst({where:{id:organizationId,status:"ACTIVE"},select:{currency:true}}),
    db.room.findMany({
      where:{organizationId,number:{equals:number,mode:"insensitive"},property:{organizationId}},
      select:{
        number:true,property:{select:{name:true}},
        occupancies:{where:{organizationId,status:{in:["ACTIVE","RESERVED"]}},
          select:{studentId:true,semesterId:true,status:true,student:{select:{fullName:true}}}}
      },take:3
    })
  ]);
  if (!organization) return {mode:"records",text:"Hostel accounting is unavailable for this session. Sign in again.",links:[]};
  if (!rooms.length) return {mode:"records",text:"Room "+number+" was not found in this hostel's room register.",links:[link("Rooms","/rooms","Open rooms")]};
  if (rooms.length>1) return {mode:"records",text:"Room number "+number+" exists in more than one of your hostel properties. Select the property before viewing private resident payments.",links:[link("Occupancies","/occupancy","Choose property")]};
  const room=rooms[0],occupants=room.occupancies;
  if (!occupants.length) return {
    mode:"records",text:"Room "+room.number+" — "+room.property.name+"\nNo active or reserved student occupancy is recorded. I cannot attribute payments to this room without identifying a current resident.",
    links:[link("Occupancies","/occupancy","Check occupancy")]
  };
  const uniqueIds=[...new Set(occupants.map(o=>o.studentId))];
  const currency=organization.currency;
  const window=await resolveFinanceWindow(db,organizationId,period);
  if(window&&"error" in window) return {
    mode:"records",text:window.error+" Room "+room.number+" has not been assigned an all-time payment total instead.",
    links:[link("Semesters","/semesters","Review periods")]
  };
  const [charges,payments]=await Promise.all([
    db.charge.findMany({where:{organizationId,studentId:{in:uniqueIds},status:{not:"WAIVED"}},
      select:{studentId:true,semesterId:true,currency:true,amount:true,
        payments:{where:{reversedAt:null},select:{studentId:true,organizationId:true,currency:true,amount:true}}}}),
    db.payment.findMany({where:{organizationId,studentId:{in:uniqueIds},reversedAt:null,...(window?{paidAt:{gte:window.start,lt:window.end}}:{})},
      select:{studentId:true,organizationId:true,currency:true,amount:true,charge:{select:{studentId:true,organizationId:true}}}})
  ]);
  const invalidCharge=charges.some(c=>c.currency!==currency || !uniqueIds.includes(c.studentId) ||
    c.payments.some(p=>p.studentId!==c.studentId||p.organizationId!==organizationId||p.currency!==currency));
  const invalidPayment=payments.some(p=>p.currency!==currency||p.organizationId!==organizationId||
    !uniqueIds.includes(p.studentId)||p.charge.organizationId!==organizationId||p.charge.studentId!==p.studentId);
  if (invalidCharge||invalidPayment) return {
    mode:"records",text:"Room "+room.number+" has an accounting identity or currency mismatch. No payment total is shown until management verifies the ledger.",
    links:[link("Financial review","/payments/audit","Review ledger")]
  };
  const factor=minorUnits(1,currency),money=(units:number)=>formatMoney(units/factor,currency);
  const lines=["Room "+room.number+" — "+room.property.name,
    "Recorded occupants and financial position:"];
  for (const occupant of occupants) {
    const current=charges.filter(c=>c.studentId===occupant.studentId&&c.semesterId===occupant.semesterId);
    let charged=0,paid=0;
    for(const charge of current) {
      const chargeAmount=minorUnits(Number(charge.amount),currency);
      const receipts=charge.payments.reduce((sum,p)=>sum+minorUnits(Number(p.amount),currency),0);
      if(receipts>chargeAmount) return {
        mode:"records",text:"An overpayment or incorrect charge was detected for Room "+room.number+". Inspect Financial Integrity before relying on an outstanding balance.",
        links:[link("Financial review","/payments/audit","Review ledger")]
      };
      charged+=chargeAmount;paid+=receipts;
    }
    const all=payments.filter(p=>p.studentId===occupant.studentId);
    const allPaid=all.reduce((sum,p)=>sum+minorUnits(Number(p.amount),currency),0);
    lines.push("");
    lines.push(occupant.student.fullName+" — "+(occupant.status==="ACTIVE"?"Active allocation":"Reserved, not checked in"));
    if(current.length) {
      lines.push("Current semester charges: "+money(charged));
      lines.push("Paid toward current semester: "+money(paid));
      lines.push("Current semester outstanding: "+money(charged-paid));
    } else {
      lines.push("No current-semester charge is linked to this allocation.");
    }
    lines.push((window?"Payments received during "+window.label:"All recorded unreversed payments (all periods)")+": "+money(allPaid)+" ("+all.length+" payment records)");
  }
  lines.push("");
  lines.push("These figures come from the hostel ledger, not a bank or M-Pesa confirmation. Shared rooms are shown resident by resident; no payment is assumed to belong to someone else.");
  if(window)lines.push("Current allocation-semester charge payments can predate the selected payment-date window; the totals are intentionally separate.");
  return {
    mode:"records",text:lines.join("\n"),
    links:[
      link("Payments",occupants.length===1?"/payments?q="+encodeURIComponent(occupants[0].student.fullName):"/payments","Open payment records"),
      link("Occupancy","/occupancy?q="+encodeURIComponent(room.number),"Verify room allocation")
    ]
  };
}
