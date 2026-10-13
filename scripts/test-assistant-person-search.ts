import test from "node:test";
import assert from "node:assert/strict";
import type {PrismaClient} from "../src/generated/prisma/client";
import {personSearchIntent,isPersonSearchFollowup} from "../src/lib/assistant-person-intents";
import {answerPersonSearch} from "../src/lib/assistant-person-search";
import {hostelKnowledgeTopic} from "../src/lib/assistant-knowledge-intents";
import {occupancySearchShortcut} from "../src/lib/assistant-search-policy";
import {answerHostelQuestion} from "../src/lib/assistant-service";

const resident=(id:string,fullName:string,status="ACTIVE",room="41")=>({
 id,fullName,status,occupancies:room?[{room:{number:room},status:"ACTIVE",semester:{name:"September–December 2026"}}]:[]
});
const candidates=[resident("a","David Kirumba","ACTIVE","41"),resident("b","David Njoroge","ACTIVE","22"),resident("c","David Wanjala","CHECKED_OUT","")];
function dbFor(rows:ReturnType<typeof resident>[] = candidates) {
 const calls={student:0,user:0,other:0};
 const db={
  user:{findFirst:async({where}:any)=>{calls.user++;assert.equal(where.organizationId,"mama-mbugua-hostel");return{id:"owner",role:"OWNER",sessionVersion:0};}},
  student:{findMany:async({where,take,select}:any)=>{
    calls.student++;
    assert.equal(where.organizationId,"mama-mbugua-hostel");
    assert.equal(take,101);assert.equal(select.fullName,true);
    return rows.filter(s=>s.fullName.toLowerCase().includes(where.fullName.contains.toLowerCase()));
  }},
  $transaction:async()=>{calls.other++;assert.fail("A person lookup must not access the generative AI budget");},
  room:{findMany:async()=>{calls.other++;assert.fail("Should not query room availability");}},
  payment:{findMany:async()=>{calls.other++;assert.fail("Should not query payments");}}
 } as unknown as PrismaClient;
 return{db,calls};
}
const session={userId:"owner",organizationId:"mama-mbugua-hostel",name:"Owner",role:"OWNER" as const,sessionVersion:0};
test("screenshots: both David questions resolve as person searches, not room vacancy",()=>{
 assert.deepEqual(personSearchIntent("Am looking for David kirumba"),{kind:"student-search",name:"David kirumba",asksAvailability:false});
 assert.deepEqual(personSearchIntent("Which David is available"),{kind:"student-search",name:"David",asksAvailability:true});
 assert.equal(occupancySearchShortcut("Find David Kirumba"),"David Kirumba"); // UI must bypass this shortcut first
 assert.equal(hostelKnowledgeTopic("Which David is available"),"vacancy"); // routing must give person search precedence
});
test("alternate natural person language and strict follow-up classification",()=>{
 for(const q of ["I'm looking for David Kirumba","Find David Kirumba","Where is David Kirumba?","Show me David","Is David registered?","Do we have a student named David Kirumba?","Who is David Kirumba?"])
  assert.ok(personSearchIntent(q),q);
 for(const q of ["Who hasn't paid?","Which rooms are available?","How much is the rent?","Where is the hostel?","Show payment receipt"])
  assert.equal(personSearchIntent(q),null,q);
 assert.equal(isPersonSearchFollowup("Which one is active?"),true);
 assert.equal(isPersonSearchFollowup("Is he currently staying?"),true);
 assert.equal(isPersonSearchFollowup("Which David is available"),false);
});
test("an exact resident is retrieved from scoped student records, not invented chatbot content",async()=>{
 const {db,calls}=dbFor();
 const result=await answerPersonSearch(db,"mama-mbugua-hostel","OWNER","David Kirumba");
 assert.match(result.text,/1 matching student record/);
 assert.match(result.text,/David Kirumba — active; Recorded room 41/);
 assert.doesNotMatch(result.text,/David Njoroge/);
 assert.doesNotMatch(result.text,/free bed spaces|vacancy/);
 assert.equal(calls.student,1);assert.equal(calls.other,0);
});
test("'Which David is available' lists David matches and does not invent physical availability",async()=>{
 const {db}=dbFor();
 const result=await answerPersonSearch(db,"mama-mbugua-hostel","OWNER","David",true);
 assert.match(result.text,/David Kirumba/);
 assert.match(result.text,/David Njoroge/);
 assert.match(result.text,/David Wanjala — checked out/);
 assert.match(result.text,/physically present/);
 assert.match(result.text,/Which meaning do you want/);
 assert.doesNotMatch(result.text,/Bedsitter|KES/);
});
test("unknown surname searches matching first-name candidates without claiming an exact match",async()=>{
 const {db}=dbFor();
 const result=await answerPersonSearch(db,"mama-mbugua-hostel","OWNER","David Krumba");
 assert.match(result.text,/could not find an exact name match/);
 assert.match(result.text,/David Kirumba/);
 assert.equal(result.contextName,"David");
});
test("unknown first name is accurately reported and offers student and visitor registers",async()=>{
 const {db}=dbFor();
 const result=await answerPersonSearch(db,"mama-mbugua-hostel","OWNER","NoSuchName");
 assert.match(result.text,/No student named/);
 assert.ok(result.links.some(x=>x.href==="/visitors"));
});
test("caretaker is denied before querying student identities",async()=>{
 const {db,calls}=dbFor();
 const result=await answerPersonSearch(db,"mama-mbugua-hostel","CARETAKER","David");
 assert.match(result.text,/requires a management account/);
 assert.equal(calls.student,0);
});
test("full authorized assistant routes screenshot questions before model and vacancy",async()=>{
 const key="resident-ai-person-search-test-secret-2026";
 const prev=process.env.SESSION_SECRET;
 process.env.SESSION_SECRET=key;
 try{
  const {db,calls}=dbFor();
  const provider=async()=>{assert.fail("Generative provider must not be used for personal record lookup");return{text:"",inputTokens:0,outputTokens:0};};
  const one=await answerHostelQuestion(db,session,false,"Am looking for David kirumba",provider);
  assert.equal(one.mode,"records");
  assert.match(one.text,/David Kirumba/);
  const pointer="contextToken" in one && typeof one.contextToken==="string"?one.contextToken:null;
  assert.ok(pointer);
  const two=await answerHostelQuestion(db,session,false,"Which David is available",provider);
  assert.equal(two.mode,"records");
  assert.match(two.text,/David Njoroge/);
  assert.doesNotMatch(two.text,/free bed spaces/);
  assert.equal(calls.other,0);
  const three=await answerHostelQuestion(db,session,false,"Which one is active?",provider,pointer);
  assert.equal(three.mode,"records");
  assert.match(three.text,/David Kirumba/);
 }finally{if(prev===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=prev;}
});
