import type { PrismaClient } from "@/generated/prisma/client";

export type OperationalIntent =
 | {kind:"room";number:string} | {kind:"overdue-visitors"} | {kind:"visitor-count"}
 | {kind:"registrations"} | {kind:"receipt-queue"} | {kind:"gate-staff"} | {kind:"whatsapp-queue"} | {kind:"rollout"} | null;
export function operationalIntent(question:string):OperationalIntent {
 const q=question.trim().toLowerCase();if(!q||q.length>1200)return null;
 if(/(?:who|which|show|list|find|check|how many|any|nani|onyesha)/.test(q)&&/(?:visitor|guest|wageni|check(?:ed)?[\s-]?out|departure|left|overdue)/.test(q)){
  if(/(?:not[\s-]?checked[\s-]?out|hasn.t[\s-]?checked[\s-]?out|haven.t[\s-]?checked[\s-]?out|overdue|departure.*not|not.*departed|still inside|not left|haven.t left)/.test(q))return{kind:"overdue-visitors"};
  if(/(?:how many|number|total|count|pending visitors|expected visitors)/.test(q))return{kind:"visitor-count"};
 }
 // "Where are we?" is a hostel operations question, not an invitation for the
 // external language model to invent a project status.
 if(/(?:where are we|what remains|what(?:'s| is) left|what next|hostel (?:status|progress|readiness|rollout|activation)|operational (?:status|readiness)|system progress)/.test(q)&&
    !/(?:whats?\\s*app|receipts?|payments?|balance|room\\s*\\d+|visitors?)/.test(q))return{kind:"rollout"};
 const room=q.match(/\\broom\\s*(?:number\\s*)?([0-9]{1,5}[a-z]?)\\b/i);
 if(room&&/(?:who|occup(?:y|ies|ant)|student|tenant|resident|room status|in room|nani)/.test(q))return{kind:"room",number:room[1].toUpperCase()};
 if(/(?:pending|awaiting|waiting|how many|show|list)/.test(q)&&/(?:registrations?|portal approval|account requests?)/.test(q))return{kind:"registrations"};
 if(/(?:whats?\s*app|wa\s+messages?)/.test(q)&&/(?:pending|queued|draft|unsent|not sent|opened|sending|failed|delivery|delivered|how many|count|status|backlog)/.test(q))
   return {kind:"whatsapp-queue"};
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
 if(intent.kind==="rollout"){
  const [active,enabled,pending,caretakers,visits,queued,opened,providerConfirmed]=await Promise.all([
    db.student.count({where:{organizationId,status:"ACTIVE"}}),
    db.student.count({where:{organizationId,status:"ACTIVE",portalEnabled:true,portalPasswordHash:{not:null}}}),
    db.tenantRegistration.count({where:{organizationId,status:"PENDING",expiresAt:{gt:now}}}),
    db.user.count({where:{organizationId,role:"CARETAKER",active:true}}),
    db.visitorRequest.count({where:{organizationId}}),
    db.notification.count({where:{organizationId,channel:"WHATSAPP",status:"QUEUED"}}),
    db.notification.count({where:{organizationId,channel:"WHATSAPP",status:"OPENED_FOR_SENDING"}}),
    db.whatsAppDelivery.count({where:{organizationId,status:{in:["DELIVERED","READ"]}}}),
  ]);
  return {mode:"records",text:
    `Hostel operational rollout as of ${now.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})}: ${active} active students, ${enabled} with an enabled password-backed portal (${Math.max(0,active-enabled)} still to activate); ${pending} pending registration requests, which may contain repeated applicants; ${caretakers} active caretaker accounts; ${visits} recorded visitor requests. WhatsApp: ${queued} queued drafts, ${opened} opened without confirmed sending, and ${providerConfirmed} recorded provider-delivered/read messages.\nNext actions: independently verify the pending students, appoint a real restricted caretaker, test an actual visitor entry and exit, and establish consented WhatsApp Business delivery. These are recorded system counts, not proof of physical presence or external delivery. No records were changed.`,
    links:[
      link("Tenant verification","/students/registrations","Review grouped cases"),
      link("Gate readiness","/gate-readiness","Review operator and visitor checks"),
      link("WhatsApp centre","/communications/whatsapp","Review sending evidence"),
      link("HealthFix","/healthfix","Review operational warnings"),
    ]};
 }
 if(intent.kind==="whatsapp-queue"){
  const [queued,opened,marked,failed,delivered]=await Promise.all([
   db.notification.count({where:{organizationId,channel:"WHATSAPP",status:"QUEUED"}}),
   db.notification.count({where:{organizationId,channel:"WHATSAPP",status:"OPENED_FOR_SENDING"}}),
   db.notification.count({where:{organizationId,channel:"WHATSAPP",status:"SENT"}}),
   db.notification.count({where:{organizationId,channel:"WHATSAPP",status:"FAILED"}}),
   db.whatsAppDelivery.count({where:{organizationId,status:{in:["DELIVERED","READ"]}}}),
  ]);
  return{mode:"records",text:
   `${queued} WhatsApp drafts are queued; ${opened} were opened but are not confirmed sent; ${failed} need failed-draft review. ${marked} were marked sent manually (not provider-confirmed). ${delivered} provider delivery/read receipts are recorded. These are distinct workflow counters and must not be added as a unique-recipient total. No messages were sent or retried by this answer.`,
   links:[link("WhatsApp operations","/communications/whatsapp","Review drafts and provider results")]};
 }
 if(intent.kind==="registrations"){
  const count=await db.tenantRegistration.count({where:{organizationId,status:"PENDING",expiresAt:{gt:now}}});
  return{mode:"records",text:String(count)+" eligible tenant registration requests await management identity verification. No accounts have been activated.",links:[link("Registrations","/students/registrations","Review requests")]};
 }
 const count=await db.payment.count({where:{organizationId,reversedAt:null,receiptDeliveryStatus:{in:["PENDING","FAILED","ACTION_REQUIRED"]}}});
 return{mode:"records",text:String(count)+" unreversed payment receipts remain pending, failed or require delivery follow-up. An opened WhatsApp composer is not delivery confirmation. Nothing has been resent.",links:[link("Receipt queue","/payments?delivery=all","Review receipts")]};
}
