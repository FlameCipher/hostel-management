import type { PrismaClient } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/currency";
import { TERMS_CONTACT, TERMS_ORGANIZATION_ID, TERMS_RULES, TERMS_VERSION } from "@/lib/hostel-terms/policy";
import { hostelKnowledgeTopic, officialPolicyTopics } from "./assistant-knowledge-intents";

export type KnowledgeAudience = "TENANT" | "CARETAKER" | "MANAGEMENT";
export type KnowledgeReply = { mode:"records"; text:string; links:Array<{title:string;href:string;action:string}> };
const action=(title:string,href:string,action:string)=>({title,href,action});
const unknown=(subject:string)=>subject+" is not recorded in the verified hostel information. Management should confirm it before the AI answers as fact.";
const published=(org:string,audience:KnowledgeAudience)=>({organizationId:org,active:true,...(audience==="TENANT"?{publicListing:true}:{})});
const tidy=(text:string|null|undefined)=>text?.trim()||null;

/** Only signed-in tenants' published property information and authorized staff records. */
export async function answerHostelKnowledge(db:PrismaClient,organizationId:string,audience:KnowledgeAudience,question:string):Promise<KnowledgeReply|null> {
 const topic=hostelKnowledgeTopic(question);
 if(!topic)return null;
 const isManagement=audience==="MANAGEMENT";
 const [org,properties]=await Promise.all([
  db.organization.findUnique({where:{id:organizationId},select:{id:true,status:true,name:true,ownerName:true,phone:true,email:true,currency:true}}),
  db.property.findMany({where:published(organizationId,audience),select:{
    id:true,name:true,city:true,physicalAddress:true,phone:true,email:true,customDomain:true,
    publicDescription:true,timeZone:true,rentPaymentMethods:true,publicListing:true
  },orderBy:{name:"asc"},take:40})
 ]);
 if(!org||org.status!=="ACTIVE")return {mode:"records",text:"Hostel information is unavailable for this account.",links:[]};
 const one=properties.length===1?properties[0]:null;
 const policyAvailable=organizationId===TERMS_ORGANIZATION_ID;
 const propertyLabel=one?.name??org.name;
 const links=[action("Hostel website","/","Open hostel")];
 if(topic==="history")return {mode:"records",text:unknown("A verified founding date and complete hostel history"),links:isManagement?[action("My Website","/website","Review official details")]:links};
 if(topic==="contact"||topic==="location"){
  if(properties.length===0)return {mode:"records",text:unknown("Published hostel contact/location"),links};
  const rows=properties.map(p=>{
    const lines=[p.name];
    if(topic==="location"){
      lines.push("Address: "+(tidy(p.physicalAddress)??(policyAvailable&&p.name.toUpperCase()==="MMAMBUGUA HOSTEL"?TERMS_CONTACT.location:"Not recorded")));
      if(p.city)lines.push("City: "+p.city);
    }else{
      lines.push("Contact phone: "+(tidy(p.phone)??(policyAvailable&&p.name.toUpperCase()==="MMAMBUGUA HOSTEL"?TERMS_CONTACT.phone:"Not recorded")));
      lines.push("Published email: "+(tidy(p.email)??"Not recorded"));
      if(isManagement)lines.push("Recorded organization owner: "+(tidy(org.ownerName)??"Not recorded"));
    }
    if(p.customDomain)lines.push("Website: https://"+p.customDomain);
    return lines.join("\n");
  });
  return {mode:"records",text:rows.join("\n\n")+"\nSource: current hostel property records. Confirm travel directions before leaving.",links};
 }
 if(topic==="policy"||topic==="facilities"){
  if(/\b(?:electricity|power outage|blackout|power cut|generator|solar backup)\b/i.test(question))
    return {mode:"records",text:unknown("Verified electricity provision, backup-power capacity and current power status")+" The documented Wi-Fi and borehole policies cannot establish electricity availability.",links:isManagement?[action("Website settings","/website","Confirm and publish facilities")]:links};
  if(!policyAvailable)return {mode:"records",text:unknown("Approved written accommodation rules for this hostel")+" Avoid treating general guidance as a signed agreement.",links};
  const names=officialPolicyTopics(question);
  const relevant=names.length?TERMS_RULES.filter(rule=>names.includes(rule.title)):
    topic==="facilities"?TERMS_RULES.filter(rule=>["CCTV and Wi-Fi","Borehole water"].includes(rule.title)):TERMS_RULES;
  const excerpts=relevant.map(r=>r.title+"\n"+r.text);
  return {mode:"records",text:"MMAMBUGUA HOSTEL — approved accommodation terms ("+TERMS_VERSION+"):\n\n"+excerpts.join("\n\n")+"\n\nThese are published policy terms, not a real-time test of Wi-Fi, CCTV, water or gate operations.",links:[action("Hostel terms",audience==="TENANT"?"/tenant/account":"/student-terms","Review terms")]};
 }
 if(topic==="booking")return{mode:"records",text:propertyLabel+" offers a website booking workflow. Choose the hostel and room category, submit your actual details, and wait for the hostel's confirmation. An enquiry is not a confirmed allocation or a recorded payment. Existing residents should use Student sign in → Create my tenant account instead.",links:[action("Booking","/book","Open booking"),action("Student sign in","/tenant/login","Open resident portal")]};
 if(topic==="semester"){
  if(!isManagement&&properties.length===0)return {mode:"records",text:unknown("A published hostel academic calendar"),links};
  const semesters=await db.semester.findMany({where:{organizationId,...(!isManagement?{status:{in:["ACTIVE","UPCOMING"] as Array<"ACTIVE"|"UPCOMING">}}:{})},select:{name:true,startDate:true,endDate:true,status:true},orderBy:{startDate:"desc"},take:12});
  const date=(v:Date)=>new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Nairobi",dateStyle:"medium"}).format(v);
  const text=semesters.length?semesters.map(s=>s.name+" — "+s.status+" — "+date(s.startDate)+" to "+date(s.endDate)).join("\n"):unknown("An active/upcoming academic semester");
  return {mode:"records",text:"Recorded hostel semesters:\n"+text+"\nCheck your own allocated semester before making payment decisions.",links:[action("Semesters",isManagement?"/semesters":"/tenant/account","Review details")]};
 }
 if(topic==="pricing"||topic==="vacancy"){
  if(!isManagement&&properties.length===0)return {mode:"records",text:unknown("Public hostel accommodation and room rates"),links};
  const allowed=properties.map(p=>p.id);
  const rooms=await db.room.findMany({where:{organizationId,propertyId:{in:allowed},roomType:{organizationId,active:true}},select:{
    status:true,capacityOverride:true,propertyId:true,
    roomType:{select:{id:true,name:true,monthlyRate:true,semesterRate:true,currency:true,sharingMode:true,defaultCapacity:true}},
    occupancies:{where:{organizationId,status:{in:["ACTIVE","RESERVED"]}},select:{id:true}}
  },take:1001});
  if(rooms.length>1000)return {mode:"records",text:"There are more than 1,000 room records. A complete availability or pricing answer requires the filtered property inventory; no partial figure is reported.",links:[action("Rooms",isManagement?"/rooms":"/","Review rooms")]};
  const groups=new Map<string,{name:string;property:string;currency:string;monthly:number;semester:number;sharing:string;capacity:number;rooms:number;freeSpaces:number;maintenance:number}>();
  const propertyNames=new Map(properties.map(p=>[p.id,p.name]));
  for(const room of rooms){
    const type=room.roomType;
    const key=room.propertyId+":"+type.id;
    const row=groups.get(key)??{name:type.name,property:propertyNames.get(room.propertyId)??"Property",currency:type.currency,monthly:Number(type.monthlyRate),semester:Number(type.semesterRate),sharing:String(type.sharingMode),capacity:type.defaultCapacity,rooms:0,freeSpaces:0,maintenance:0};
    row.rooms++;
    if(room.status==="MAINTENANCE"||room.status==="INACTIVE")row.maintenance++;
    else if(room.status!=="FULL")row.freeSpaces+=Math.max(0,(room.capacityOverride??type.defaultCapacity)-room.occupancies.length);
    groups.set(key,row);
  }
  const rows=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));
  const lines=rows.map(r=>(properties.length>1?r.property+" · ":"")+r.name+" ("+r.sharing+") — "+formatMoney(r.monthly,r.currency)+" monthly; "+formatMoney(r.semester,r.currency)+" semester. "+r.rooms+" recorded rooms"+(topic==="vacancy"?"; "+r.freeSpaces+" nominal free bed spaces":""));
  const explanation=topic==="vacancy"?"Availability is a live record estimate, not a guaranteed vacancy or room reservation. Holds, temporary closures, pending transfers and actual occupancy must be rechecked by management.":"Rates are the current configured room-type prices; individual negotiated rent and student payments may differ. Confirm the selected room and semester before quoting a binding amount.";
  return {mode:"records",text:lines.length?"Current recorded hostel room categories:\n"+lines.join("\n")+"\n\n"+explanation:unknown("Active rooms and published room-type rates"),links:[action("Rooms",isManagement?"/rooms":"/","Review accommodation")]};
 }
 if(topic==="coverage"||topic==="overview"){
  if(topic==="coverage"&&!isManagement)return {mode:"records",text:"Management maintains the detailed knowledge-completeness report. I can answer verified public accommodation, fees, visitor terms and location questions where those records have been published.",links};
  const missing=[];
  for(const property of properties){
    if(!tidy(property.physicalAddress))missing.push(property.name+": address");
    if(!tidy(property.phone))missing.push(property.name+": published contact phone");
    if(!tidy(property.publicDescription))missing.push(property.name+": verified hostel description");
  }
  const header="Verified hostel knowledge for "+org.name+":\n"+properties.map(p=>p.name+" — "+(p.physicalAddress??p.city??"address not recorded")+(p.publicDescription?". "+p.publicDescription.slice(0,450):"")).join("\n");
  const data="\nCurrent sources: property and room register, room-type rates, semester calendar, protected finance and visitor modules, the authenticated student portal"+(policyAvailable?", official accommodation terms "+TERMS_VERSION:" (no verified organization-specific accommodation terms found)")+".";
  const caveat="\nThis assistant reads records; it has not memorized every undocumented event, physically tested facilities or independently confirmed payments. Information you have not entered remains unknown.";
  return {mode:"records",text:header+data+caveat+(isManagement?"\nManagement knowledge gaps: "+(missing.length?missing.join("; "):"No missing public identity/contact fields detected; physical verification and other business workflows still require acceptance."):""),links:isManagement?[action("Website settings","/website","Maintain hostel information"),action("Rooms","/rooms","Maintain rooms"),action("Semesters","/semesters","Maintain semesters")]:links};
 }
 return null;
}
