import { getSession } from "@/lib/auth/session";
import { getTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { answerHostelQuestion } from "@/lib/assistant-service";
import { sameOrigin } from "@/lib/service-security";
import { issueAssistantVoiceTicket } from "@/lib/assistant-voice-policy";
import type { SessionPayload } from "@/lib/auth/session";
import type { TenantSession } from "@/lib/auth/tenant-session";
export const runtime="nodejs";
export const maxDuration=40;
export async function POST(request:Request) {
 const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
 if(!sameOrigin(request))return Response.json({error:"Request not allowed."},{status:403,headers});
 if(Number(request.headers.get("content-length")??0)>8000)return Response.json({error:"Question too long."},{status:413,headers});
 try {const raw=await request.text();if(raw.length>8000)return Response.json({error:"Question too long."},{status:413,headers});const body=JSON.parse(raw);const tenant=body.audience==="tenant";const session=tenant?await getTenantSession():await getSession();const contextToken=typeof body.contextToken==="string"&&body.contextToken.length<=1200?body.contextToken:null;const result=await answerHostelQuestion(db,session,tenant,typeof body.question==="string"?body.question:"",undefined,contextToken);// Every authenticated, non-error assistant reply can obtain the same hostel assistant
 // narrator through a short-lived, exact-text signed ticket. No audio or private
 // text is sent to the voice provider until the user explicitly presses Listen.
 // The UI obtains additional permission before private records are narrated.
 const voiceTicket=session&&["ai","records","guide","workflow"].includes(result.mode??"")&&typeof result.text==="string"?
  issueAssistantVoiceTicket(result.text,{
   organizationId:session.organizationId,
   subjectId:tenant?(session as TenantSession).studentId:(session as SessionPayload).userId,
   audience:tenant?"tenant":"staff",
   sessionVersion:session.sessionVersion??0
  },process.env.SESSION_SECRET??""):null;
 return Response.json({...result,...(voiceTicket?{voiceTicket}:{})},{status:"status" in result?result.status:200,headers});}
 catch{return Response.json({error:"The assistant is temporarily unavailable. Use the guide below."},{status:503,headers});}
}
