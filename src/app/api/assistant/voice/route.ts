import { getSession } from "@/lib/auth/session";
import { getTenantSession } from "@/lib/auth/tenant-session";
import { residentStaff,residentTenant } from "@/lib/resident-access";
import { db } from "@/lib/db";
import { sameOrigin } from "@/lib/service-security";
import { ASSISTANT_VOICE_MAX_CHARS, assistantSpeechText, HOSTEL_VOICE_INSTRUCTIONS, verifyAssistantVoiceTicket } from "@/lib/assistant-voice-policy";
export const runtime="nodejs";
export const maxDuration=35;
const responseHeaders={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const MAX_REQUEST_BYTES=18000;
export async function POST(request:Request) {
 if(!sameOrigin(request))return Response.json({error:"Request not allowed."},{status:403,headers:responseHeaders});
 if(Number(request.headers.get("content-length")??0)>MAX_REQUEST_BYTES)
  return Response.json({error:"Narration request too long."},{status:413,headers:responseHeaders});
 let raw:string;
 try {raw=await request.text();}catch{return Response.json({error:"Invalid request."},{status:400,headers:responseHeaders});}
 if(raw.length>MAX_REQUEST_BYTES)return Response.json({error:"Narration request too long."},{status:413,headers:responseHeaders});
 let body:unknown;
 try {body=JSON.parse(raw);}catch{return Response.json({error:"Invalid request."},{status:400,headers:responseHeaders});}
 if(!body||typeof body!=="object")return Response.json({error:"Invalid request."},{status:400,headers:responseHeaders});
 const data=body as Record<string,unknown>;
 const text=typeof data.text==="string"?data.text:"";
 if(!text||text.length>ASSISTANT_VOICE_MAX_CHARS)return Response.json({error:"Narration text must be shorter."},{status:400,headers:responseHeaders});
 if(data.audience!=="tenant"&&data.audience!=="staff")return Response.json({error:"Invalid account audience."},{status:400,headers:responseHeaders});
 const tenant=data.audience==="tenant";
 const session=tenant?await getTenantSession():await getSession();
 if(!session)return Response.json({error:"Sign in again to use narrator."},{status:401,headers:responseHeaders});
 const eligible=tenant?await residentTenant(db,session as Awaited<ReturnType<typeof getTenantSession>>)
  :await residentStaff(db,session as Awaited<ReturnType<typeof getSession>>);
 if(!eligible)return Response.json({error:"Account access has changed. Sign in again."},{status:401,headers:responseHeaders});
 const principal={organizationId:session.organizationId,
  subjectId:tenant?"studentId" in session?session.studentId:"":"userId" in session?session.userId:"",
  audience:tenant?"tenant" as const:"staff" as const,sessionVersion:session.sessionVersion??0};
 if(!verifyAssistantVoiceTicket(text,data.voiceTicket,principal,process.env.SESSION_SECRET??""))
  return Response.json({error:"Narration request expired or does not match a verified assistant reply. Play it using the device speaker instead."},{status:403,headers:responseHeaders});
 const key=process.env.OPENAI_API_KEY?.trim();
 if(!key)return Response.json({error:"Premium narration is unavailable. Use the device reader."},{status:503,headers:responseHeaders});
 const voiceText=assistantSpeechText(text);
 if(!voiceText)return Response.json({error:"No readable text."},{status:400,headers:responseHeaders});
 // One-hourly budget prevents automated replays from becoming uncontrolled
 // voice-billing requests. Every attempt is attributable to its signed account.
 const who="tts:"+principal.audience+":"+principal.subjectId;
 const now=new Date(),hourAgo=new Date(now.getTime()-3600000),minuteAgo=new Date(now.getTime()-60000);
 const attempt=await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hostel-voice-budget'))`;
  const [userHourly,userMinute,orgHourly]=await Promise.all([
   tx.assistantRun.count({where:{organizationId:session.organizationId,principal:who,createdAt:{gte:hourAgo}}}),
   tx.assistantRun.count({where:{organizationId:session.organizationId,principal:who,createdAt:{gte:minuteAgo}}}),
   tx.assistantRun.count({where:{organizationId:session.organizationId,model:"openai/tts",createdAt:{gte:hourAgo}}})
  ]);
  if(userHourly>=20||userMinute>=3||orgHourly>=200)return null;
  return tx.assistantRun.create({data:{organizationId:session.organizationId,principal:who,model:"openai/tts"}});
 });
 if(!attempt)return Response.json({error:"Narration limit reached. Use the device speaker or try later."},{status:429,headers:responseHeaders});
 try {
  const controller=new AbortController();
  const abort=setTimeout(()=>controller.abort(),24000);
  let response:Response;
  try {
   response=await fetch("https://api.openai.com/v1/audio/speech",{
    method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
    body:JSON.stringify({model:"gpt-4o-mini-tts",voice:"onyx",input:voiceText,
      instructions:HOSTEL_VOICE_INSTRUCTIONS,response_format:"mp3"}),
    cache:"no-store",signal:controller.signal
   });
  }finally{clearTimeout(abort);}
  if(!response.ok||!response.headers.get("content-type")?.includes("audio/"))
   throw Error("VOICE_PROVIDER_UNAVAILABLE");
  const audio=await response.arrayBuffer();
  if(!audio.byteLength||audio.byteLength>9000000)throw Error("VOICE_AUDIO_SIZE");
  await db.assistantRun.update({where:{id:attempt.id},data:{status:"COMPLETED"}});
  return new Response(audio,{status:200,headers:{...responseHeaders,"Content-Type":"audio/mpeg"}});
 }catch {
  await db.assistantRun.update({where:{id:attempt.id},data:{status:"FAILED"}}).catch(()=>undefined);
  return Response.json({error:"Kinari-style narration could not play just now. Use device speech."},{status:503,headers:responseHeaders});
 }
}
