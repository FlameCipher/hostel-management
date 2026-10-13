import type { PrismaClient } from "@/generated/prisma/client";
import { tenantWhere } from "@/lib/communications";
import { managedPropertyHost } from "@/lib/property-host-policy";

export type AnnouncementIntent={kind:"account-update"|"general";audience:"ALL"};
export type AnnouncementDraft={
  title:string;body:string;category:"GENERAL";
  audience:"ALL";recipientCount:number;emailCount:number;whatsappOptInCount:number;
  propertyName:string;updateLink:string|null;loginLink:string|null;registerLink:string|null;
};

export function announcementIntent(question:string):AnnouncementIntent|null{
 const q=question.trim().toLowerCase();
 if(!q||q.length>1200)return null;
 if(!/\b(?:send|post|publish|broadcast|announce|notify|tell|message|write|draft|prepare)\b/.test(q))return null;
 if(!/\b(?:message|announcement|notice|students?|tenants?|residents?|everyone|all)\b/.test(q))return null;
 // Do not invent recipients for requests explicitly addressing one student or a selected subgroup.
 if(!/\b(?:all|every|everyone|each)\s+(?:of\s+)?(?:the\s+)?(?:student|students|tenant|tenants|resident|residents)\b/.test(q)&&
    !/\b(?:whole|entire)\s+(?:hostel|student|tenant)\b/.test(q))return null;
 const update=/\b(?:update|complete|confirm|correct|verify|validate|review)\b/.test(q)&&
  /\b(?:hostel|tenant|student|personal|account|details|information|profile|registration|records?)\b/.test(q);
 return {kind:update?"account-update":"general",audience:"ALL"};
}

export function accountUpdateText(propertyName:string,updateLink:string,loginLink:string,registerLink:string){
 const title="URGENT: Confirm and update your hostel account details";
 const body=[
  "Dear "+propertyName+" student,",
  "",
  "IMPORTANT: Please urgently check and update your hostel student records so management can keep your details and emergency contacts accurate.",
  "",
  "Update your registered student and guardian details securely: "+updateLink,
  "Already have a tenant portal account? Sign in here: "+loginLink,
  "Currently staying here but never created a portal account? Request access: "+registerLink,
  "",
  "Use your actual registered name and mobile number to verify your record. Updates and new portal access requests require management verification.",
  "Do not share your password, PIN, national ID number or private account information in WhatsApp replies or group chats.",
  "",
  "Please complete this as soon as possible and contact hostel management if you have difficulty.",
  "",
  propertyName+" Management"
 ].join("\n");
 return {title,body};
}

/** Server-side read-only preview. No announcement is published here. */
export async function prepareAnnouncementDraft(database:PrismaClient,organizationId:string,intent:AnnouncementIntent){
 const [properties,students,consents]=await Promise.all([
  database.property.findMany({where:{organizationId,active:true,publicListing:true},select:{id:true,name:true,customDomain:true},take:3}),
  database.student.findMany({where:tenantWhere(organizationId),select:{id:true,email:true},take:5001}),
  database.whatsAppConsent.findMany({where:{organizationId,audience:"tenant",enabled:true},select:{accountId:true},take:5001})
 ]);
 const base=[{title:"Communication centre",href:"/communications",action:"Review announcement centre"}];
 if(students.length>5000)return {mode:"guide" as const,text:"This hostel has more than 5,000 eligible current tenants. Refine the audience in the communication centre; I have not created or sent a message.",links:base};
 if(intent.kind==="account-update") {
  if(properties.length!==1)return {mode:"guide" as const,text:"I cannot safely choose one account-update link because this organization has no single published hostel property. Open the communication centre and confirm the correct property first. No message has been sent.",links:base};
  const property=properties[0],host=managedPropertyHost(property.customDomain);
  if(!host)return {mode:"guide" as const,text:"The published property's account-update address is not a verified hostel-specific managed domain. Confirm its website address first; I have not drafted or sent a mass announcement.",links:base};
  const origin="https://"+host;
  const text=accountUpdateText(property.name,origin+"/update-details",origin+"/tenant/login",origin+"/tenant/register");
  const consentSet=new Set(consents.map(c=>c.accountId));
  const draft:AnnouncementDraft={...text,category:"GENERAL",audience:"ALL",recipientCount:students.length,
   emailCount:students.filter(s=>Boolean(s.email?.trim())).length,
   whatsappOptInCount:students.filter(s=>consentSet.has(s.id)).length,
   propertyName:property.name,updateLink:origin+"/update-details",loginLink:origin+"/tenant/login",registerLink:origin+"/tenant/register"};
  return {
   mode:"workflow" as const,workflow:"announcement" as const,
   text:"I have prepared an urgent account-update announcement for "+students.length+" current hostel tenant"+(students.length===1?"":"s")+".\nThe complete message and verified hostel links are ready below for your review. Nothing has been published or sent. Confirm the audience, edit the text if needed, and explicitly approve the portal notice. Email and WhatsApp are separate optional channels.",
   links:base,draft
  };
 }
 return {mode:"workflow" as const,workflow:"announcement" as const,
  text:"I have opened an announcement editor for "+students.length+" current tenants. Please write the exact notice, review the audience and approve before publishing. No messages have been sent.",
  links:base,draft:{title:"Hostel management announcement",body:"",category:"GENERAL",audience:"ALL",recipientCount:students.length,emailCount:students.filter(s=>Boolean(s.email?.trim())).length,
   whatsappOptInCount:students.filter(s=>consents.some(c=>c.accountId===s.id)).length,propertyName:properties.length===1?properties[0].name:"Hostel",updateLink:null,loginLink:null,registerLink:null} satisfies AnnouncementDraft};
}
