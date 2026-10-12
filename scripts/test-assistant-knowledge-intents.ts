import assert from "node:assert/strict";
import test from "node:test";
import {hostelKnowledgeTopic,officialPolicyTopics} from "../src/lib/assistant-knowledge-intents";
test("maps documented hostel knowledge categories",()=>{
 const cases:Record<string,string>={"Tell me everything about MMAMBUGUA hostel":"overview","How much is a bedsitter per semester?":"pricing","How much for a single room this semester?":"pricing",
 "Are any rooms vacant?":"vacancy","Where is the hostel near Gate B?":"location",
 "What time does the gate close in the evening?":"policy","Does it have WiFi and borehole water?":"facilities",
 "Who owns the hostel?":"contact","What academic semester are we in?":"semester","How can I book a room?":"booking",
 "What information is missing?":"coverage","When was this hostel founded?":"history","How much is the rent?":"pricing","How much is accommodation per semester?":"pricing"};
 for(const [q,intent] of Object.entries(cases))assert.equal(hostelKnowledgeTopic(q),intent,q);
});
test("identifies exact authoritative policy topics without inventing new rules",()=>{
 assert.deepEqual(officialPolicyTopics("Can my guest stay overnight?"),["Visitors and occupants"]);
 assert.deepEqual(officialPolicyTopics("What time can we enter the gate at night?"),["Entry and exit hours"]);
 assert.deepEqual(officialPolicyTopics("Is CCTV and water available?"),["CCTV and Wi-Fi","Borehole water"]);
});
test("does not classify sensitive account requests as public knowledge",()=>{
 assert.equal(hostelKnowledgeTopic("How much did room 41 pay?"),null);
 assert.equal(hostelKnowledgeTopic("What is Sheila Nyaboke balance?"),null);
 assert.equal(hostelKnowledgeTopic("Register a student"),null);
});
