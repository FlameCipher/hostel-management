import { db } from "@/lib/db";
import { healthfixAuthorized } from "@/lib/healthfix";
import { runServiceDelivery } from "@/lib/service-delivery";
export const runtime="nodejs";
export const maxDuration=120;
export async function GET(request:Request){if(!healthfixAuthorized(process.env.CRON_SECRET,request.headers.get("authorization")?.replace(/^Bearer /,"")??null))return new Response("Unauthorized",{status:401});const result=await runServiceDelivery(db);return Response.json(result,{status:result.status==="FAILED"?503:200,headers:{"Cache-Control":"no-store"}});}
