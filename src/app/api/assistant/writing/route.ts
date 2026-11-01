import { getSession } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/service-security";
import { db } from "@/lib/db";
import { prepareMessageDraft } from "@/lib/assistant-writing";
export const runtime="nodejs";
export const maxDuration=40;
export async function POST(request:Request){
 const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
 if(!sameOrigin(request))return Response.json({error:"Request not allowed."},{status:403,headers});
 try {
  const raw=await request.text();if(raw.length>16000)return Response.json({error:"Message too long."},{status:413,headers});
  const body=JSON.parse(raw);
  const result=await prepareMessageDraft(db,await getSession(),{text:typeof body.text==="string"?body.text:"",language:typeof body.language==="string"?body.language:""});
  return Response.json(result,{status:"status" in result?result.status:200,headers});
 }catch{return Response.json({error:"The writing assistant is unavailable. Your message has not been sent."},{status:503,headers});}
}
