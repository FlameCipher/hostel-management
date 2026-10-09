import test from "node:test";
import assert from "node:assert/strict";
import {assistantEnabled} from "../src/lib/assistant-service";
import {backupConfigured} from "../src/lib/production-backup";
test("backup OIDC remains independent of the direct OpenAI credential",()=>{
 assert(!assistantEnabled({NODE_ENV:"test",HOSTEL_AI_ENABLED:"true",HOSTEL_AI_MODEL:"fixture",VERCEL:"1"} as NodeJS.ProcessEnv));
 assert(!assistantEnabled({NODE_ENV:"test",HOSTEL_AI_ENABLED:"true",HOSTEL_AI_MODEL:"fixture"} as NodeJS.ProcessEnv));
 const previous={VERCEL:process.env.VERCEL,BACKUP_BLOB_STORE_ID:process.env.BACKUP_BLOB_STORE_ID,VERCEL_OIDC_TOKEN:process.env.VERCEL_OIDC_TOKEN,BACKUP_BLOB_READ_WRITE_TOKEN:process.env.BACKUP_BLOB_READ_WRITE_TOKEN};
 try{process.env.VERCEL="1";process.env.BACKUP_BLOB_STORE_ID="fixture";delete process.env.VERCEL_OIDC_TOKEN;delete process.env.BACKUP_BLOB_READ_WRITE_TOKEN;assert(backupConfigured());delete process.env.VERCEL;assert(!backupConfigured());}finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

import {serviceDiagnostic} from "../src/lib/service-security";
test("operator diagnostics redact bearer credentials and connection URLs",()=>{
 const message=serviceDiagnostic(Error('Request failed Bearer abcdefghi.123456789.signature postgresql://owner:private@db.example/data'));
 assert(!message.includes('private'));assert(!message.includes('abcdefghi'));assert(!message.includes('db.example'));
});
