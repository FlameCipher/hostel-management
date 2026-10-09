import { getSession } from "@/lib/auth/session";
import { getTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { answerHostelQuestion } from "@/lib/assistant-service";
import { sameOrigin } from "@/lib/service-security";
export const runtime="nodejs";
export const maxDuration=40;
export async function POST(request:Request) {
 const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
 if(!sameOrigin(request))return Response.json({error:"Request not allowed."},{status:403,headers});
 if(Number(request.headers.get("content-length")??0)>8000)return Response.json({error:"Question too long."},{status:413,headers});
 try {const raw=await request.text();if(raw.length>8000)return Response.json({error:"Question too long."},{status:413,headers});const body=JSON.parse(raw);const tenant=body.audience==="tenant";const session=tenant?await getTenantSession():await getSession();const result=await answerHostelQuestion(db,session,tenant,typeof body.question==="string"?body.question:"");return Response.json(result,{status:"status" in result?result.status:200,headers});}
 catch{return Response.json({error:"The assistant is temporarily unavailable. Use the guide below."},{status:503,headers});}
}
