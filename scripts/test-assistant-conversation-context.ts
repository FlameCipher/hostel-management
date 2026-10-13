import assert from "node:assert/strict";
import test from "node:test";
import {issueAssistantContext,readAssistantContext,isRoomFinanceFollowup} from "../src/lib/assistant-conversation-context";
const key="test-session-key-that-is-long-enough-for-hmac-2026";
const a={organizationId:"hostel-one",userId:"owner-one",role:"OWNER",sessionVersion:3};
const now=new Date("2026-10-13T00:00:00Z");
test("signed context binds organization, user, role and session version",()=>{
 const token=issueAssistantContext({kind:"room",number:"41"},a,key,now);
 assert.ok(token);
 assert.deepEqual(readAssistantContext(token,a,key,new Date(now.getTime()+1000)),{kind:"room",number:"41"});
 for(const change of [{organizationId:"hostel-two"},{userId:"owner-two"},{role:"CARETAKER"},{sessionVersion:4}])
  assert.equal(readAssistantContext(token,{...a,...change},key,now),null);
});
test("tampered, missing and expired pointers never resolve",()=>{
 const t=issueAssistantContext({kind:"room",number:"41"},a,key,now);
 assert.equal(readAssistantContext(t?.slice(0,-1)+"x",a,key,now),null);
 assert.equal(readAssistantContext(t,a,key,new Date(now.getTime()+15*60*1000)),null);
 assert.equal(readAssistantContext(t,a,"wrong-secret-must-be-longer-than-thirty-two",now),null);
 assert.equal(readAssistantContext("../",a,key,now),null);
});
test("follow-up parser is conservative and never assumes a new identity",()=>{
 for(const q of ["How much has he paid?","And what is her balance?","What about his payment?","Show their payments"])
  assert.equal(isRoomFinanceFollowup(q),true,q);
 for(const q of ["What is the password?","Register that student","Who is in room 12?","Send him a receipt","How much have we collected?"])
  assert.equal(isRoomFinanceFollowup(q),false,q);
});

test("student-name pointer is authenticated, expires, and never grants finance access",()=>{
 const token=issueAssistantContext({kind:"student-search",query:"David Kirumba"},a,key,now);
 assert.ok(token);
 assert.deepEqual(readAssistantContext(token,a,key,new Date(now.getTime()+1000)),{kind:"student-search",query:"David Kirumba"});
 assert.equal(readAssistantContext(token,{...a,organizationId:"other-hostel"},key,now),null);
 assert.equal(readAssistantContext(token,{...a,role:"CARETAKER"},key,now),null);
 assert.equal(readAssistantContext(token,{...a,sessionVersion:4},key,now),null);
 assert.equal(readAssistantContext(token,a,key,new Date(now.getTime()+900001)),null);
 assert.equal(issueAssistantContext({kind:"student-search",query:"../../private-secrets"} as any,a,key,now),null);
});
