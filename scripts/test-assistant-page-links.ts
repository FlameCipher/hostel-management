import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client";
import { studentLinkIntent, safeStudentLink, assistantPage, answerStudentLinks } from "../src/lib/assistant-navigation";
import { answerHostelQuestion } from "../src/lib/assistant-service";

const session = { userId: "owner", organizationId: "hostel-a", name: "Owner", role: "OWNER" as const, sessionVersion: 0 };
const noModel = async () => { assert.fail("Page and link requests must not call an AI model"); };
function database(properties = [{ name: "Example hostel", customDomain: "example.studentshostels.com" }]) {
  return { user: { findFirst: async () => ({ id: "owner", role: "OWNER", sessionVersion: 0 }) }, property: { findMany: async ({ where }: { where: { organizationId: string } }) => {
    assert.equal(where.organizationId, "hostel-a"); return properties;
  } } } as unknown as PrismaClient;
}

test("existing student update questions resolve to a verified full public link before staff workflows", async () => {
  for (const q of ["Give me a link for existing students to update their details", "How can existing students update their account?", "Share the student details update link", "Open the student update details page"]) {
    const answer = await answerHostelQuestion(database(), session, false, q, noModel);
    assert.match(answer.text!, /https:\/\/example.studentshostels.com\/update-details/);
    assert.ok("shareLinks" in answer && Array.isArray(answer.shareLinks) && answer.shareLinks.length === 1);
    if(q.startsWith("Open")) assert.equal("navigateTo" in answer && answer.navigateTo, "https://example.studentshostels.com/update-details");
    else assert.ok(!("navigateTo" in answer), "Link remains available for copying");
    assert.deepEqual(answer.links, []);
  }
});

test("page commands use permitted routes and do not confuse instructions with navigation", async () => {
  const answer = await answerHostelQuestion(database(), session, false, "Please open the payments page", noModel);
  assert.equal("navigateTo" in answer && answer.navigateTo, "/payments");
  assert.equal(assistantPage("Open students", "CARETAKER", "CARETAKER"), null);
  assert.equal(assistantPage("Open Users & Permissions", "MANAGEMENT", "MANAGER"), null);
  assert.equal(assistantPage("Open payments", "TENANT"), null);
  assert.equal(assistantPage("Open my account", "TENANT")?.href, "/tenant/account");
  assert.equal(assistantPage("How do I open payments?", "MANAGEMENT", "OWNER"), null);
  assert.equal(assistantPage("Show me payments for Mary", "MANAGEMENT", "OWNER"), null);
  assert.equal(assistantPage("Open https://example.com", "MANAGEMENT", "OWNER"), null);
});

test("student sharing excludes staff pages, query tokens and unverified destinations", () => {
  assert.ok(safeStudentLink({ title: "Update", url: "https://example.studentshostels.com/update-details" }));
  for (const url of ["/students", "https://example.studentshostels.com/students", "https://example.studentshostels.com/update-details?token=private", "https://example.studentshostels.com/tenant/profile", "https://example.studentshostels.com.evil.test/update-details", "javascript:alert(1)", "https://user:password@example.studentshostels.com/update-details"]) assert.equal(safeStudentLink({ title: "Test", url }), false, url);
});

test("ambiguous or missing property domains never guess another hostel", async () => {
  for (const properties of [[], [{ name: "Unverified", customDomain: "evil.test" }], [{ name: "One", customDomain: "one.studentshostels.com" }, { name: "Two", customDomain: "two.studentshostels.com" }]]) {
    const answer = await answerStudentLinks(database(properties), "hostel-a", "update");
    assert.equal("shareLinks" in answer, false);
    assert.match(answer.text, /could not verify/);
  }
});

test("portal and access links preserve existing account flows", () => {
  assert.equal(studentLinkIntent("Give me student login link"), "login");
  assert.equal(studentLinkIntent("Link for students to request access"), "register");
  assert.equal(studentLinkIntent("Approve pending student details update requests"), null);
  assert.equal(studentLinkIntent("Who has not paid?"), null);
  assert.equal(studentLinkIntent("Register a new student"), null);
  assert.equal(studentLinkIntent("Correct student payment account"), null);
});

test("service requests distinguish new applicants, existing accounts and payment entry", async () => {
  for (const [question,path] of [["Give me new student registration link","/book"],["Copy Pesapal payment link","/pay-rent"],["Open Pesapal","/payments/requests"]]) {
    const answer=await answerHostelQuestion(database(),session,false,question,noModel);
    if(question.startsWith("Open")) assert.equal("navigateTo" in answer && answer.navigateTo,path);
    else assert.ok("shareLinks" in answer && Array.isArray(answer.shareLinks) && answer.shareLinks.some(link=>link.url.endsWith(path)));
  }
  const all=await answerHostelQuestion(database(),session,false,"Give me all service links",noModel);
  assert.ok("shareLinks" in all && Array.isArray(all.shareLinks) && all.shareLinks.length===5);
  assert.ok(all.links?.some(link=>link.href==="/services"));
  assert.equal(studentLinkIntent("New and existing student registration links"),"all");
  assert.equal(assistantPage("Open Pesapal","CARETAKER","CARETAKER"),null);
});

test("assistant routes message audiences and staff PDF requests without sending", async () => {
  for(const [q,path] of [["Send message to female students","/communications?audience=FEMALE"],["Message male students","/communications?audience=MALE"],["Send message to selected tenants","/communications?audience=SELECTED"],["Send message to all students","/communications?audience=ALL"],["Send message to students who have not paid","/reports/arrears"],["Share unpaid list to caretaker via WhatsApp as PDF","/reports/unpaid"]]) {
    const answer=await answerHostelQuestion(database(),session,false,q,noModel);
    assert.equal(answer.links?.[0]?.href,path,q);
    assert.match(answer.text!,/No (?:message|report) has been sent/);
  }
});
