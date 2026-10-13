import type {PrismaClient} from "@/generated/prisma/client";
import {personSearchIntent} from "@/lib/assistant-person-intents";

type StaffRole="OWNER"|"ADMIN"|"MANAGER"|"CARETAKER";
type SearchReply={mode:"records";text:string;links:{title:string;href:string;action:string}[];contextName?:string};
const link=(title:string,href:string,action:string)=>({title,href,action});
const normalize=(name:string)=>name.trim().toLocaleLowerCase("en").replace(/\s+/g," ");
export async function answerPersonSearch(db:PrismaClient,organizationId:string,role:StaffRole,name:string,asksAvailability=false):Promise<SearchReply>{
 if(role==="CARETAKER")return {mode:"records",text:"Finding students by name requires a management account. Gate staff should verify visitors using the authorized visitor register.",links:[link("Visitor register","/visitors","Open visitors")]};
 const tokens=normalize(name).split(" ").filter(Boolean);
 if(!tokens.length||tokens.some(t=>t.length>40)||tokens.length>6)return{mode:"records",text:"Enter a student's registered name or first name to search.",links:[]};
 // Limit candidates before choosing; no fuzzy guesses or cross-organization search.
 const candidates=await db.student.findMany({
  where:{organizationId,fullName:{contains:tokens[0],mode:"insensitive"}},
  select:{id:true,fullName:true,status:true,
   occupancies:{where:{organizationId,status:{in:["ACTIVE","RESERVED"]}},
    select:{room:{select:{number:true}},status:true,semester:{select:{name:true}}},take:4}
  },orderBy:{fullName:"asc"},take:101
 });
 if(candidates.length>100)return{mode:"records",text:"More than 100 registered students match that name. Please provide a fuller registered name; I will not return an incomplete list.",links:[link("Students","/students","Search register")]};
 const exact=candidates.filter(s=>tokens.every(t=>normalize(s.fullName).includes(t)));
 const fallback=exact.length?exact:candidates;
 const broad=!exact.length && tokens.length>1;
 const narrowed=fallback.slice(0,20);
 const category=broad?'I could not find an exact name match for "'+name+'". These records share the first-name search "'+tokens[0]+'":':exact.length===0?'No student named "'+name+'" was found in the authorized hostel register.':String(exact.length)+' matching student record'+(exact.length===1?"":"s")+' for "'+name+'":';
 if(!fallback.length)return{
  mode:"records",text:category+"\nI searched the registered student records, not the room-availability catalogue. If you meant a visitor rather than a resident, check the separate visitor register.",
  links:[link("Students","/students","Search students"),link("Visitors","/visitors","Search visitors")],
  contextName:tokens[0]
 };
 const lines=narrowed.map((s,i)=>{
  const rooms=[...new Set(s.occupancies.map(o=>o.room.number))];
  const allocation=rooms.length===1?"Recorded room "+rooms[0]:rooms.length>1?"Multiple current room allocations":"No current room allocation";
  return String(i+1)+". "+s.fullName+" — "+s.status.replaceAll("_"," ").toLowerCase()+"; "+allocation+
    (s.occupancies.length===1?"; "+s.occupancies[0].semester.name:"");
 });
 const trailing=exact.length>narrowed.length?"\nShowing "+narrowed.length+" of "+exact.length+" matches. Refine the name for a complete result.":"";
 return {
  mode:"records",
  text:category+"\n"+lines.join("\n")+trailing+"\n"+(asksAvailability
   ?"If by 'available' you mean physically present, reachable by phone, or available to meet, these records cannot confirm that. They show only registration and room allocation status. Which meaning do you want?"
   :"These are registered student and room-allocation records, not proof a person is physically present. You can ask which of these students is currently registered.")+
   "\nNo student or payment records were changed.",
  links:[link("Student register","/students","Open students"),link("Occupancy","/occupancy","Check allocations")],
  contextName:broad?name.trim().split(/\s+/)[0]:name
 };
}
export {personSearchIntent};
