import { db } from "@/lib/db";
import { healthfixAuthorized } from "@/lib/healthfix";
import { backupHttpStatus, runProductionBackup } from "@/lib/production-backup";
export const runtime="nodejs";
export const maxDuration=120;
export async function GET(request:Request){if(!healthfixAuthorized(process.env.CRON_SECRET,request.headers.get("authorization")?.replace(/^Bearer /,"")??null))return new Response("Unauthorized",{status:401});const result=await runProductionBackup(db);return Response.json(result,{status:backupHttpStatus(result.status),headers:{"Cache-Control":"no-store"}});}
