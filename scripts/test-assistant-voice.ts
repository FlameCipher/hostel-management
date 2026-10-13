import assert from "node:assert/strict";
import test from "node:test";
import {
 issueAssistantVoiceTicket,verifyAssistantVoiceTicket,assistantSpeechText,
 ASSISTANT_VOICE_MAX_CHARS,HOSTEL_VOICE_INSTRUCTIONS
} from "../src/lib/assistant-voice-policy";

const secret="test-hostel-signed-voice-key-never-deploy-this-secret-2026";
const actor={organizationId:"hostel-1",subjectId:"owner-1",audience:"staff" as const,sessionVersion:6};
const message="Welcome. You can review hostel rules and available services.";
const now=new Date("2026-10-13T05:00:00.000Z");

test("tickets bind exact AI answer and prevent swapping in a private student ledger",()=>{
 const token=issueAssistantVoiceTicket(message,actor,secret,now);
 assert.ok(token);
 assert.equal(verifyAssistantVoiceTicket(message,token,actor,secret,new Date(now.getTime()+1000)),true);
 assert.equal(verifyAssistantVoiceTicket("Student Jane paid KES 9,000.",token,actor,secret,now),false);
 assert.equal(verifyAssistantVoiceTicket(message,token+"x",actor,secret,now),false);
 assert.equal(verifyAssistantVoiceTicket(message,"bad",actor,secret,now),false);
});
test("no speaker ticket can be replayed across hostel, role, person or revoked session",()=>{
 const token=issueAssistantVoiceTicket(message,actor,secret,now);
 for(const part of [
  {organizationId:"other-hostel"},{subjectId:"staff-2"},{audience:"tenant" as const},{sessionVersion:7}
 ]){
  assert.equal(verifyAssistantVoiceTicket(message,token,{...actor,...part},secret,now),false);
 }
});
test("premium voice ticket expires after five minutes and never authorizes future replay",()=>{
 const token=issueAssistantVoiceTicket(message,actor,secret,now);
 assert.equal(verifyAssistantVoiceTicket(message,token,actor,secret,new Date(now.getTime()+5*60000)),false);
 assert.equal(verifyAssistantVoiceTicket(message,token,actor,secret,new Date(now.getTime()+2*60000)),true);
 assert.equal(verifyAssistantVoiceTicket(message,token,actor,secret,new Date(now.getTime()-1)),false);
});
test("long, empty and weak-secret voice requests are rejected",()=>{
 assert.equal(issueAssistantVoiceTicket("",actor,secret,now),null);
 assert.equal(issueAssistantVoiceTicket("x".repeat(ASSISTANT_VOICE_MAX_CHARS+1),actor,secret,now),null);
 assert.equal(issueAssistantVoiceTicket(message,actor,"weak",now),null);
 assert.equal(verifyAssistantVoiceTicket(message,{},actor,secret,now),false);
});
test("narration cleans markdown without removing finance-relevant content",()=>{
 const raw="# Heading\n- Room 41 owes **KES 4,500.00**.\n- [View account](/tenant/account)";
 const clean=assistantSpeechText(raw);
 assert.match(clean,/Room 41 owes KES 4,500.00/);
 assert.match(clean,/View account/);
 assert.doesNotMatch(clean,/\*\*|\/tenant\/account|# Heading/);
 assert.match(HOSTEL_VOICE_INSTRUCTIONS,/deep male.*calm/);
 assert.match(HOSTEL_VOICE_INSTRUCTIONS,/Preserve meaningful words, amounts, names and dates/);
});
test("Kinari premium uses explicit route authentication, tickets and volume controls in source",async()=>{
 const fs=await import("node:fs");
 const r=fs.readFileSync("src/app/api/assistant/voice/route.ts","utf8");
 const api=fs.readFileSync("src/app/api/assistant/route.ts","utf8");
 const ui=fs.readFileSync("src/components/system-assistant.tsx","utf8");
 assert.match(r,/sameOrigin\(request\)/);
 assert.match(r,/verifyAssistantVoiceTicket\(/);
 assert.match(r,/residentStaff\(db,/);
 assert.match(r,/residentTenant\(db,/);
 assert.match(r,/audio\/speech/);
 assert.match(r,/gpt-4o-mini-tts/);
 assert.match(r,/voice:"onyx"/);
 assert.match(r,/no-store/);
 assert.match(api,/result.mode==="ai"/);
 assert.doesNotMatch(api,/result.mode==="records".*issueAssistantVoiceTicket/);
 assert.match(ui,/Listen · Kinari voice/);
 assert.match(ui,/Read response aloud/);
 assert.match(ui,/Stop reading this response/);
});
