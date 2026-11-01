import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "../src/generated/prisma/client";
import { writingIntent,writingLanguage } from "../src/lib/assistant-writing-policy";
import { prepareMessageDraft } from "../src/lib/assistant-writing";
test("writing intent supports both languages without taking over payment corrections",()=>{
 for(const q of ["Correct spelling in this message", "Write a message in English: please update details", "Andika ujumbe kwa Kiswahili", "Translate this into Kiswahili", "Rewrite my message"])assert.ok(writingIntent(q),q);
 for(const q of ["Correct this payment", "Who has not paid?", "Register a new student", "Send message to female students"])assert.equal(writingIntent(q),false,q);
 assert.equal(writingLanguage("andika kwa Kiswahili"),"Kiswahili");assert.equal(writingLanguage("polish in English"),"English");
});
test("writer requires current management and never reads recipients or sends messages",async()=>{
 const keys=["HOSTEL_AI_ENABLED","HOSTEL_AI_MODEL","OPENAI_API_KEY"],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{HOSTEL_AI_ENABLED:"true",HOSTEL_AI_MODEL:"fixture-model",OPENAI_API_KEY:"fixture-key"});
 try{
  let allowed=true,exhausted=false,generated=0;const updates:unknown[]=[];
  const tx={assistantRun:{count:async()=>exhausted?9999:0,create:async()=>({id:"run"})},$executeRaw:async()=>{}};
  const db={user:{findFirst:async(args:{where:{organizationId:string;role:unknown}})=>{assert.equal(args.where.organizationId,"one");assert.deepEqual(args.where.role,{in:["OWNER","ADMIN","MANAGER"]});return allowed?{id:"owner",sessionVersion:0}:null;}},$transaction:async(fn:(tx:unknown)=>unknown)=>fn(tx),assistantRun:{update:async(args:unknown)=>{updates.push(args);}}} as unknown as PrismaClient;
  const session={userId:"owner",organizationId:"one",name:"Owner",role:"OWNER" as const,sessionVersion:0};
  const generator=async(text:string,language:string)=>{generated++;assert.equal(language,"Kiswahili");assert.equal(text,"Please update your details.");return{text:"Tafadhali sasisha taarifa zako.",inputTokens:5,outputTokens:5};};
  const input={text:"Please update your details.",language:"Kiswahili"};
  assert.equal((await prepareMessageDraft(db,null,input,generator)).status,403);
  allowed=false;assert.equal((await prepareMessageDraft(db,session,input,generator)).status,403);allowed=true;
  assert.equal((await prepareMessageDraft(db,session,{...input,language:"unknown"},generator)).status,400);
  exhausted=true;assert.equal((await prepareMessageDraft(db,session,input,generator)).status,429);exhausted=false;
  const answer=await prepareMessageDraft(db,session,input,generator);assert.equal(answer.draft,"Tafadhali sasisha taarifa zako.");assert.equal(generated,1);assert.equal(updates.length,1);
 }finally{for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
test("editing requests and copying drafts require deliberate user actions",()=>{
 const ui=readFileSync(new URL("../src/components/system-assistant.tsx",import.meta.url),"utf8");
 assert.match(ui,/Edit request/);assert.match(ui,/setQuestion\(message.text\)/);assert.match(ui,/earlier messages stay/);
 const writer=readFileSync(new URL("../src/components/assistant-message-writer.tsx",import.meta.url),"utf8");
 assert.match(writer,/clipboard.writeText\(draft\)/);assert.match(writer,/navigator.share\(\{text:draft\}\)/);assert.match(writer,/Editing here does not change messages already delivered/);
});
