import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "../src/generated/prisma/client";
import { backupHttpStatus, runProductionBackup } from "../src/lib/production-backup";

test("backup cron only returns HTTP 200 for confirmed completion or intentional non-production skip",()=>{
 assert.equal(backupHttpStatus("COMPLETED"),200);
 assert.equal(backupHttpStatus("SKIPPED"),200);
 for(const status of ["NOT_CONFIGURED","FAILED","RUNNING","UNKNOWN","", "PARTIAL"]){
   assert.equal(backupHttpStatus(status),503,status);
 }
 const route=readFileSync("src/app/api/cron/backups/route.ts","utf8");
 assert.match(route,/backupHttpStatus\(result.status\)/);
 assert.match(route,/healthfixAuthorized\(/);
 assert.match(route,/status:401/);
 assert.match(route,/Cache-Control":"no-store/);
});

test("missing private backup destination creates an explicit failed run, not a fabricated successful backup",async()=>{
 const previous={env:process.env.VERCEL_ENV,store:process.env.BACKUP_BLOB_STORE_ID};
 let calls=0;
 const writes:Array<{data:{kind:string;status:string;completedAt?:Date;metadata?:Record<string,unknown>}}>=[];

 const db={operationalRun:{create:async(args:{data:{kind:string;status:string;completedAt?:Date;metadata?:Record<string,unknown>}})=>{
   calls++;writes.push(args);return{id:"check-missing-store"};
 }}} as unknown as PrismaClient;
 try{
  process.env.VERCEL_ENV="production";
  process.env.BACKUP_BLOB_STORE_ID="";
  const result=await runProductionBackup(db);
  assert.equal(result.status,"NOT_CONFIGURED");
  assert.equal(result.stage,"configuration");
  assert.equal(calls,1);
  assert.equal(writes[0].data.kind,"BACKUP");
  assert.equal(writes[0].data.status,"FAILED");
  assert(writes[0].data.completedAt instanceof Date);
  assert.equal(writes[0].data.metadata?.code,"PRIVATE_BACKUP_STORAGE_NOT_CONFIGURED");
  assert.equal(writes[0].data.metadata?.stage,"configuration");
  assert.doesNotMatch(JSON.stringify(writes),/postgres:\/\/|secret|token|Bearer/i);
  assert.equal(backupHttpStatus(result.status),503);
 }finally{
  if(previous.env===undefined)delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV=previous.env;
  if(previous.store===undefined)delete process.env.BACKUP_BLOB_STORE_ID;
  else process.env.BACKUP_BLOB_STORE_ID=previous.store;
 }
});

test("preview backup checks intentionally skip without touching production records",async()=>{
 const previous=process.env.VERCEL_ENV;
 let wrote=false;
 const db={operationalRun:{create:async()=>{wrote=true;throw Error("no write expected");}}} as unknown as PrismaClient;
 try{
  process.env.VERCEL_ENV="preview";
  const result=await runProductionBackup(db);
  assert.equal(result.status,"SKIPPED");
  assert.equal(backupHttpStatus(result.status),200);
  assert.equal(wrote,false);
 }finally{
  if(previous===undefined)delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV=previous;
 }
});
