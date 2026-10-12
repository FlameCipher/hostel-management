import type { PrismaClient } from "@/generated/prisma/client";

export type OperationalIntent =
 | {kind:"room";number:string} | {kind:"overdue-visitors"} | {kind:"visitor-count"}
 | {kind:"registrations"} | {kind:"receipt-queue"} | {kind:"gate-staff"} | null;
export function operationalIntent(question:string):OperationalIntent {
 const q=question.trim().toLowerCase();if(!q||q.length>1200)return null;
 if(/(?:who|which|show|list|find|check|how many|any|nani|onyesha)/.test(q)&&/(?:visitor|guest|wageni|check(?:ed)?[\s-]?out|departure|left|overdue)/.test(q)){
  if(/(?:not[\s-]?checked[\s-]?out|hasn.t[\s-]?checked[\s-]?out|haven.t[\s-]?checked[\s-]?out|overdue|departure.*not|not.*departed|still inside|not left|haven.t left)/.test(q))return{kind:"overdue-visitors"};
  if(/(?:how many|number|total|count|pending visitors|expected visitors)/.test(q))return{kind:"visitor-count"};
 }
 const room=q.match(/\broom\s*(?:number\s*)?([0-9]{1,5}[a-z]?)\b/i);
 if(room&&/(?:who|occup(?:y|ies|ant)|student|tenant|resident|room status|in room|nani)/.test(q))return{kind:"room",number:room[1].toUpperCase()};
 if(/(?:pending|awaiting|waiting|how many|show|list)/.test(q)&&/(?:registrations?|portal approval|account requests?)/.test(q))return{kind:"registrations"};
 if(/(?:pending|waiting|unsent|failed|not sent|delivery)/.test(q)&&/receipts?/.test(q))return{kind:"receipt-queue"};
 if(/(?:how many|show|active|registered)/.test(q)&&/(?:caretaker|gate staff|security staff)/.test(q))return{kind:"gate-staff"};
 return null;
}
type RecordLink={title:string;href:string;action:string};
type OperationalAnswer={mode:"records";text:string;links:RecordLink[]};
const link=(title:string,href:string,action:string):RecordLink=>({title,href,action});
export async function answerOperationalQuestion(db:PrismaClient,organizationId:string,role:"OWNER"|"ADMIN"|"MANAGER"|"CARETAKER",intent:Exclude<OperationalIntent,null>,now=new Date()):Promise<OperationalAnswer> {
 if(intent.kind==="room"){
  const rooms=await db.room.findMany({where:{organizationId,number:{equals:intent.number,mode:"insensitive"}},select:{
   number:true,property:{select:{name:true}},status:true,
   occupancies:{where:{organizationId,status:{in:["ACTIVE","RESERVED"]}},select:{student:{select:{fullName:true}},status:true}}
  },take:3});
  if(!rooms.length)return{mode:"records",text:"Room "+intent.number+" is not found in your organization's register.",links:[link("Rooms","/rooms","Open rooms")]};
  if(rooms.length>1)return{mode:"records",text:"Multiple properties use room "+intent.number+". Select the correct property in the occupancy register.",links:[link("Rooms","/rooms","Select property")]};
  const room=rooms[0],names=room.occupancies.map(x=>x.student.fullName+" ("+x.status.toLowerCase()+")");
  return{mode:"records",text:"Room "+room.number+", "+room.property.name+". Recorded status: "+room.status+". "+(names.length?"Recorded residents: "+names.join("; ")+".":"No current resident allocation is recorded.")+" An allocation is not independent proof of physical presence.",links:[link("Occupancies","/occupancy","Verify allocations")]};
 }
 if(intent.kind==="overdue-visitors"){
  const where={organizationId,status:"CHECKED_IN",checkedOutAt:null,expectedDeparture:{lt:now}};
  const [count,items]=await Promise.all([db.visitorRequest.count({where}),db.visitorRequest.findMany({where,select:{visitorName:true,roomLabel:true,expectedDeparture:true},orderBy:{expectedDeparture:"asc"},take:15})]);
  const rows=items.map((v,i)=>String(i+1)+". "+v.visitorName+" — "+v.roomLabel+" (expected departure "+v.expectedDeparture.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})+")");
  return{mode:"records",text:String(count)+" visitors have overdue unrecorded departure."+ (rows.length?"\n"+rows.join("\n"):"")+(count>items.length?"\nOnly the first "+items.length+" records are shown.":"")+"\nThis does NOT confirm that they are still on site. The gate must verify actual departure.",links:[link("Overdue departures","/visitors?filter=OVERDUE","Open gate queue")]};
 }
 if(intent.kind==="visitor-count"){
  const [expected,inside,checkedOut]=await Promise.all([
   db.visitorRequest.count({where:{organizationId,status:{in:["REQUESTED","APPROVED"]}}}),
   db.visitorRequest.count({where:{organizationId,status:"CHECKED_IN",checkedOutAt:null}}),
   db.visitorRequest.count({where:{organizationId,checkedOutAt:{not:null}}})
  ]);
  return{mode:"records",text:String(expected)+" pending/expected visitor requests, "+inside+" recorded checked-in with no recorded departure, and "+checkedOut+" recorded checked-out. These are system entries, not physical-presence verification.",links:[link("Visitors","/visitors","Open gate register")]};
 }
 if(intent.kind==="gate-staff"){
  const count=await db.user.count({where:{organizationId,active:true,role:"CARETAKER"}});
  return{mode:"records",text:String(count)+" active caretaker/security accounts are recorded. The register does not establish that an operator has signed in at the gate on their own device.",links:[link("Rooms and gate","/visitors","Review operations")]};
 }
 if(role==="CARETAKER")return{mode:"records",text:"Only authorized management may access registration and financial delivery records.",links:[link("Gate","/visitors","Open visitor gate")]};
 if(intent.kind==="registrations"){
  const count=await db.tenantRegistration.count({where:{organizationId,status:"PENDING",expiresAt:{gt:now}}});
  return{mode:"records",text:String(count)+" eligible tenant registration requests await management identity verification. No accounts have been activated.",links:[link("Registrations","/students/registrations","Review requests")]};
 }
 const count=await db.payment.count({where:{organizationId,reversedAt:null,receiptDeliveryStatus:{in:["PENDING","FAILED","ACTION_REQUIRED"]}}});
 return{mode:"records",text:String(count)+" unreversed payment receipts remain pending, failed or require delivery follow-up. An opened WhatsApp composer is not delivery confirmation. Nothing has been resent.",links:[link("Receipt queue","/payments?delivery=all","Review receipts")]};
}
