import test from "node:test";
import assert from "node:assert/strict";
import { occupancySearchShortcut } from "../src/lib/assistant-search-policy";

test("navigates explicitly requested generic occupant search",()=>{
 assert.equal(occupancySearchShortcut("Find student Jane Doe"),"Jane Doe");
 assert.equal(occupancySearchShortcut("Open room 54"),"54");
 assert.equal(occupancySearchShortcut("show room number 25A"),"25A");
});
test("keeps authoritative operational queries in the assistant",()=>{
 for(const question of [
  "Show pending registrations",
  "Show pending receipts",
  "Show receipts pending delivery",
  "Show overdue visitors",
  "Show room 54 occupants",
  "Show gate staff",
  "Show vacant rooms",
  "Show who hasn't paid",
  "Show outstanding balances",
  "Show collections",
 ]){
  assert.equal(occupancySearchShortcut(question),null,question);
 }
});
test("does not parse unrelated questions, passwords or long search strings into navigation",()=>{
 assert.equal(occupancySearchShortcut("Who is in Room 54?"),null);
 assert.equal(occupancySearchShortcut("Register student"),null);
 assert.equal(occupancySearchShortcut("Find "+"X".repeat(90)),null);
});
