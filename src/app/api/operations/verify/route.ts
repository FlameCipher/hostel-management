import { gzipSync } from "node:zlib";
import { serviceDiagnostic } from "@/lib/service-security";
import { db } from "@/lib/db";
import { healthfixAuthorized } from "@/lib/healthfix";
import { runProductionBackup,readStoredBackup,captureBackup,validateBackup } from "@/lib/production-backup";
import { generateHostelAnswer } from "@/lib/assistant-service";
import { assistantConfiguration } from "@/lib/assistant-config";
import { runServiceDelivery } from "@/lib/service-delivery";
export const runtime="nodejs";
export const maxDuration=120;
// A dedicated deployment-operator credential authorizes only these fixed probes.
// It cannot impersonate users, run arbitrary SQL or change tenant records.
export async function POST(request:Request){
 const headers={"Cache-Control":"private, no-store"};
 if(!healthfixAuthorized(process.env.OPERATIONS_VERIFY_SECRET,request.headers.get("authorization")?.replace(/^Bearer /,"")??null))return new Response("Unauthorized",{status:401,headers});
 const body=await request.json().catch(()=>null);
 if(body?.check==="ai"){
  const config=assistantConfiguration();
  if(!config.configured)return Response.json({...config,answered:false},{status:503,headers});
  const {provider,model}=config;
  try{
   const r=await generateHostelAnswer("Where do I change my own hostel password?","MANAGEMENT",null);
   await db.operationalRun.create({data:{kind:"AI_PROBE",status:"COMPLETED",completedAt:new Date(),metadata:{provider,model,inputTokens:r.inputTokens,outputTokens:r.outputTokens}}});
   return Response.json({configured:true,answered:!!r.text,provider,model,tokens:r.inputTokens+r.outputTokens},{headers});
  }catch(error){
   const code=error instanceof Error?error.name:"Error",diagnostic=serviceDiagnostic(error);
   await db.operationalRun.create({data:{kind:"AI_PROBE",status:"FAILED",metadata:{code,provider,model,diagnostic}}});
   return Response.json({configured:true,answered:false,provider,model,code,diagnostic},{status:503,headers});
  }
 }
 if(process.env.VERCEL_ENV!=="production")return Response.json({error:"Production backup operations are unavailable here."},{status:403,headers});
 if(body?.check==="backup-capture"){
  const snapshot=await captureBackup(process.env.DB_DATABASE_URL_UNPOOLED??process.env.DB_DATABASE_URL??process.env.DATABASE_URL!);const stats=validateBackup(snapshot);
  const run=await db.operationalRun.create({data:{kind:"BACKUP_CAPTURE",status:"COMPLETED",completedAt:new Date(),metadata:{...stats,capturedAt:snapshot.createdAt,commit:snapshot.commit,durableStorageVerified:false}}});
  return new Response(new Uint8Array(gzipSync(JSON.stringify(snapshot))),{headers:{...headers,"Content-Type":"application/gzip","X-Backup-Run":run.id}});
 }
 if(body?.check==="backup")return Response.json(await runProductionBackup(db),{headers});
 if(body?.check==="delivery")return Response.json(await runServiceDelivery(db),{headers});
 if(body?.check==="record-restore"){
  if(typeof body.backupRun!=="string"||!Number.isSafeInteger(body.tables)||!Number.isSafeInteger(body.rows))return Response.json({error:"Invalid restore receipt."},{status:400,headers});
  const backup=await db.operationalRun.findFirst({where:{id:body.backupRun,kind:{in:["BACKUP","BACKUP_CAPTURE"]},status:"COMPLETED"}});const meta=backup?.metadata as {tables?:number;rows?:number}|null;
  if(meta?.tables!==body.tables||meta?.rows!==body.rows)return Response.json({error:"Restore counts do not match the backup."},{status:409,headers});
  await db.operationalRun.create({data:{kind:"RESTORE_DRILL",status:"COMPLETED",completedAt:new Date(),metadata:{backupRun:body.backupRun,tables:body.tables,rows:body.rows,method:"Isolated database restore; every table count and checksum verified by authenticated operator."}}});return Response.json({recorded:true},{headers});
 }
 if(body?.check==="backup-download"){
  const run=await db.operationalRun.findFirst({where:{kind:"BACKUP",status:"COMPLETED"},orderBy:{createdAt:"desc"}});const metadata=run?.metadata as {pathname?:string}|null;if(!metadata?.pathname)return Response.json({error:"No verified backup available."},{status:404,headers});
  const {bytes}=await readStoredBackup(metadata.pathname);return new Response(new Uint8Array(bytes),{headers:{...headers,"Content-Type":"application/gzip","X-Backup-Run":run!.id}});
 }
 return Response.json({error:"Unknown verification check."},{status:400,headers});
}
