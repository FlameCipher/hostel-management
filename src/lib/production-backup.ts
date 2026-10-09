import { Client } from "pg";
import { createHash } from "node:crypto";
import { gzipSync,gunzipSync } from "node:zlib";
import { readdir,readFile } from "node:fs/promises";
import { join } from "node:path";
import { put,get,list,del } from "@vercel/blob";
import type { PrismaClient } from "@/generated/prisma/client";
export type HostelBackup={format:"hostel-logical-v1";createdAt:string;commit:string;schema:Array<{name:string;sql:string}>;assets:Array<{url:string;contentType:string;base64:string;checksum:string}>;tables:Array<{name:string;rows:string[];checksum:string}>};
export function identifier(value:string){return '"'+value.replace(/"/g,'""')+'"';}
export function backupChecksum(rows:string[]){return createHash("sha256").update(JSON.stringify([...rows].sort())).digest("hex");}
export function validateBackup(snapshot:HostelBackup){
 if(snapshot.format!=="hostel-logical-v1"||!snapshot.schema.length||!snapshot.tables.some(t=>t.name==="Organization")||new Set(snapshot.tables.map(t=>t.name)).size!==snapshot.tables.length)throw Error("INVALID_BACKUP_FORMAT");
 for(const table of snapshot.tables){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table.name)||table.checksum!==backupChecksum(table.rows))throw Error("BACKUP_CHECKSUM_MISMATCH");for(const row of table.rows)if(!JSON.parse(row)||typeof JSON.parse(row)!=="object"||Array.isArray(JSON.parse(row)))throw Error("INVALID_BACKUP_ROW");}
 for(const asset of snapshot.assets??[]){if(!allowedBackupAsset(asset.url)||createHash("sha256").update(Buffer.from(asset.base64,"base64")).digest("hex")!==asset.checksum)throw Error("BACKUP_ASSET_MISMATCH");}
 return {assets:snapshot.assets?.length??0,tables:snapshot.tables.length,rows:snapshot.tables.reduce((total,t)=>total+t.rows.length,0)};
}
export function allowedBackupAsset(value:string){try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&u.hostname.endsWith(".public.blob.vercel-storage.com");}catch{return false;}}
export async function captureAssets(tables:HostelBackup["tables"],getAsset=fetch){
 const urls=new Set<string>();for(const table of tables.filter(t=>["RoomPhoto","PropertyPhoto"].includes(t.name)))for(const row of table.rows){const photo=JSON.parse(row);if(photo.url&&!photo.deletedAt){if(!allowedBackupAsset(photo.url))throw Error("UNSUPPORTED_BACKUP_ASSET_ORIGIN");urls.add(photo.url);}}
 const assets:HostelBackup["assets"]=[];let total=0;
 for(const url of urls){const response=await getAsset(url,{redirect:"error",signal:AbortSignal.timeout(10000)});if(!response.ok||!response.body)throw Error("PHOTO_BACKUP_DOWNLOAD_FAILED");const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;total+=chunk.value.length;if(size>12*1024*1024||total>60*1024*1024){await reader.cancel();throw Error("PHOTO_BACKUP_LIMIT_EXCEEDED");}chunks.push(chunk.value);}const bytes=Buffer.concat(chunks);assets.push({url,contentType:response.headers.get("content-type")??"application/octet-stream",base64:bytes.toString("base64"),checksum:createHash("sha256").update(bytes).digest("hex")});}return assets;
}
export async function captureBackup(connectionString:string){
 const client=new Client({connectionString,connectionTimeoutMillis:10000});await client.connect();
 try{
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");await client.query("SET LOCAL statement_timeout='30s'");
  const names=await client.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename");
  const tables:HostelBackup["tables"]=[];let bytes=0;
  for(const {tablename:name} of names.rows){const result=await client.query<{row:string}>(`SELECT row_to_json(t)::text AS row FROM ${identifier(name)} t`);const rows=result.rows.map(r=>r.row);bytes+=rows.reduce((n,r)=>n+Buffer.byteLength(r),0);if(bytes>50*1024*1024)throw Error("BACKUP_EXCEEDS_SERVER_LIMIT_USE_PROVIDER_EXPORT");tables.push({name,rows,checksum:backupChecksum(rows)});}
  await client.query("COMMIT");
  const root=join(process.cwd(),"prisma/migrations");const schema=[];for(const name of (await readdir(root)).filter(n=>/^\d/.test(n)).sort())schema.push({name,sql:await readFile(join(root,name,"migration.sql"),"utf8")});
  const snapshot:HostelBackup={format:"hostel-logical-v1",createdAt:new Date().toISOString(),commit:process.env.VERCEL_GIT_COMMIT_SHA??"local",schema,tables,assets:await captureAssets(tables)};validateBackup(snapshot);return snapshot;
 }finally{await client.end();}
}
export function backupConfigured(){return Boolean(process.env.BACKUP_BLOB_STORE_ID&&(process.env.VERCEL_OIDC_TOKEN||process.env.BACKUP_BLOB_READ_WRITE_TOKEN));}
function storageOptions(){if(!backupConfigured())throw Error("BACKUP_STORAGE_NOT_CONFIGURED");return {storeId:process.env.BACKUP_BLOB_STORE_ID!,...(process.env.BACKUP_BLOB_READ_WRITE_TOKEN?{token:process.env.BACKUP_BLOB_READ_WRITE_TOKEN}: {})};}
export async function readStoredBackup(pathname:string){
 if(!/^hostel-backups\/\d{4}-\d{2}-\d{2}T[\d-]+Z-[A-Za-z0-9_-]+\.json\.gz$/.test(pathname))throw Error("INVALID_BACKUP_PATH");
 const result=await get(pathname,{...storageOptions(),access:"private"});if(!result||result.statusCode!==200)throw Error("BACKUP_NOT_FOUND");
 const bytes=Buffer.from(await new Response(result.stream).arrayBuffer());const snapshot=JSON.parse(gunzipSync(bytes,{maxOutputLength:150*1024*1024}).toString("utf8")) as HostelBackup;validateBackup(snapshot);return {snapshot,bytes};
}
export async function runProductionBackup(db:PrismaClient){
 if(process.env.VERCEL_ENV!=="production")return {status:"SKIPPED",reason:"Backups run only in production."};
 if(!backupConfigured())return {status:"NOT_CONFIGURED"};
 const run=await db.operationalRun.create({data:{kind:"BACKUP",status:"RUNNING"}});let stage="capture";
 try{
  const snapshot=await captureBackup(process.env.DB_DATABASE_URL_UNPOOLED??process.env.DB_DATABASE_URL??process.env.DATABASE_URL!);const stats=validateBackup(snapshot);const bytes=gzipSync(JSON.stringify(snapshot));
  const pathname=`hostel-backups/${snapshot.createdAt.replace(/[:.]/g,"-")}-${run.id}.json.gz`;
  stage="private-storage-write";const saved=await put(pathname,bytes,{...storageOptions(),access:"private",addRandomSuffix:false,allowOverwrite:false,contentType:"application/gzip"});
  stage="private-storage-readback";const verified=await readStoredBackup(saved.pathname);if(backupChecksum(snapshot.tables.map(t=>t.checksum))!==backupChecksum(verified.snapshot.tables.map(t=>t.checksum)))throw Error("BACKUP_READBACK_MISMATCH");
  await db.operationalRun.update({where:{id:run.id},data:{status:"COMPLETED",completedAt:new Date(),metadata:{pathname:saved.pathname,...stats,bytes:bytes.length,capturedAt:snapshot.createdAt,readbackVerified:true,restoreVerified:false,commit:snapshot.commit}}});
  // Retain at least 30 daily snapshots. Cleanup only follows a confirmed new read-back.
  const all=await list({...storageOptions(),prefix:"hostel-backups/",limit:1000});const cutoff=Date.now()-30*86400000;const old=all.blobs.filter(b=>b.uploadedAt.getTime()<cutoff);if(old.length)await del(old.map(b=>b.url),storageOptions()).catch(()=>undefined);
  return {status:"COMPLETED",id:run.id,...stats,readbackVerified:true};
 }catch(error){const code=error instanceof Error?error.name:"Error";await db.operationalRun.update({where:{id:run.id},data:{status:"FAILED",completedAt:new Date(),metadata:{stage,code,reason:"Backup capture or private-storage verification failed. Review deployment configuration; no restore was attempted."}}});return {status:"FAILED",id:run.id,stage,code};}
}
