import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { SessionPayload } from "../src/lib/auth/session";
import { answerHostelQuestion } from "../src/lib/assistant-service";
import { systemWorkflows, systemWorkflowIntent, answerSystemWorkflow } from "../src/lib/system-workflows";
import { systemGuide, searchSystemGuide } from "../src/lib/system-guide";
import { visibleStaffNavigation, type HostelStaffRole } from "../src/lib/staff-navigation-policy";

const screenshot = "How do you remove someone who has vacated and make room vacant";
const owner: SessionPayload = { userId: "owner", organizationId: "hostel-a", role: "OWNER", name: "Owner", sessionVersion: 3 };
function authenticatedDatabase(role: HostelStaffRole = "OWNER", version = 3) {
  return new Proxy({ user: { findFirst: async ({ where }: { where: Record<string, unknown> }) => {
    assert.equal(where.organizationId, "hostel-a"); assert.equal(where.active, true);
    return { id: "owner", role, sessionVersion: version };
  } } }, { get(target, key) {
    if (key in target) return target[key as keyof typeof target];
    assert.fail(`Procedure guidance must not query or mutate ${String(key)}`);
  } }) as unknown as PrismaClient;
}
const noProvider = async () => { assert.fail("Documented procedures must not depend on an external AI response"); };

test("the screenshot question returns the actual checkout procedure and only the occupancy link", async () => {
  const result = await answerHostelQuestion(authenticatedDatabase(), owner, false, screenshot, noProvider);
  assert.ok(typeof result.text === "string" && Array.isArray(result.links));
  assert.match(result.text, /View.*active stay/);
  assert.match(result.text, /Complete checkout/);
  assert.match(result.text, /Owner\/Admin.*outstanding balance/);
  assert.match(result.text, /shared room may remain partly occupied/);
  assert.match(result.text, /Maintenance and Inactive/);
  assert.match(result.text, /payment history/);
  assert.match(result.text, /No checkout has been completed/);
  assert.deepEqual(result.links.map(link => link.href), ["/occupancy"]);
  assert.doesNotMatch(result.text, /guide doesn.t describe|ask hostel management to verify the move-out/);
  const guides = searchSystemGuide(systemGuide("MANAGEMENT"), screenshot);
  assert.equal(guides.length, 1);
  assert.equal(guides[0].href, "/occupancy");
});

test("paraphrases select resident checkout without mistaking it for photographs or visitor records", () => {
  for (const question of [screenshot, "How do I make room 54 vacant?", "How can I check out a student?", "Check out Jane from room 54", "The student has vacated", "How to remove a tenant from a room", "Mwanafunzi amehama nifanyeje chumba kiwe wazi?", "How do I clear a resident with an outstanding balance?", "Explain the move out procedure"]) {
    assert.equal(systemWorkflowIntent(question), "student-checkout", question);
    assert.equal(answerSystemWorkflow(question, "MANAGEMENT", "OWNER")?.links[0]?.href, "/occupancy", question);
  }
  assert.equal(systemWorkflowIntent("How do I check out a visitor?"), "visitor-gate");
  assert.equal(systemWorkflowIntent("How do I check in a guest?"), "visitor-gate");
  assert.equal(systemWorkflowIntent("How do I report going out and returning late?"), "student-outings");
});

test("procedures cover distinct management and student modules", () => {
  const questions: Record<string, string> = {
    "How do I transfer a student to another room?": "room-transfer",
    "How do I record a holiday break decision?": "holiday-break",
    "How do I allocate a paid student?": "student-allocation",
    "How do I add a caretaker without email?": "staff-access",
    "How do I approve pending student registrations?": "registration-approval",
    "How do I register a new student?": "student-admission",
    "How do I import students from CSV?": "student-admission",
    "How do I invite students to activate their portal?": "portal-invitations",
    "How do I edit student details?": "student-records",
    "How do I remove duplicate students?": "student-records",
    "How do I review guardian contact changes?": "guardian-details",
    "How do I correct a wrong payment amount?": "payment-correction",
    "How do I record a payment?": "payment-recording",
    "How do I reconcile M-Pesa statements?": "reconciliation",
    "Open financial integrity": "financial-audit",
    "How do I change room rates?": "settings",
    "How do I correct semester rent?": "rent-adjustment",
    "How do I add rooms?": "room-register",
    "How do I manage bookings?": "booking-review",
    "How do I create a semester?": "semester-calendar",
    "How do I register student belongings?": "student-property",
    "How do I add hostel assets?": "hostel-assets",
    "How do I add an expense?": "expenses",
    "How do I export reports?": "reports",
    "How do I send a notice to selected students?": "announcements",
    "How do I create reminders?": "reminders",
    "How do I upload room photos?": "website",
    "How do I create a vacancy card?": "vacancy-card",
    "How do I set up my hostel?": "hostel-setup",
    "How do I use HealthFix?": "healthfix",
    "How do I test emergency phone calls?": "gate-readiness",
    "How do I use SOS?": "sos",
    "How do I add class reminders?": "class-timetable",
    "How do I tell security I will be late?": "student-outings",
    "Explain dashboard": "dashboard",
    "How do I send a WhatsApp draft?": "whatsapp",
    "How do I reply in the student inbox?": "private-messages",
    "How do I reset my password?": "account-password",
    "How do I install the app?": "install-app",
    "How do I review student terms?": "student-terms",
    "What can you do?": "assistant-help",
  };
  assert.deepEqual(Object.entries(questions).flatMap(([question, expected]) => {
    const actual = systemWorkflowIntent(question);
    return actual === expected ? [] : [{ question, expected, actual }];
  }), []);
});

test("live facts, finance queries and existing review workspaces retain their routes", () => {
  for (const q of ["Who hasn't paid?", "Who has not checked out?", "How many visitors are expected?", "Are any rooms vacant?", "Room 41 payments", "Who lives in room 54?", "How much has Sheila paid?", "What is my balance?", "How much is a single room?", "Register a student", "Record payment", "How many active caretaker accounts?", "What time does the gate close?", "Show payments for Sheila"]) assert.equal(systemWorkflowIntent(q), null, q);
});

test("procedures recheck live account eligibility and respect staff permissions", async () => {
  const revoked = await answerHostelQuestion(authenticatedDatabase("OWNER", 4), owner, false, screenshot, noProvider);
  assert.ok("status" in revoked); assert.equal(revoked.status, 401);
  for (const role of ["OWNER", "ADMIN", "MANAGER", "CARETAKER"] as const) {
    const answer = await answerHostelQuestion(authenticatedDatabase(role), owner, false, "How do I add a caretaker?", noProvider);
    assert.ok(typeof answer.text === "string" && Array.isArray(answer.links));
    if (role === "OWNER" || role === "ADMIN") assert.equal(answer.links[0].href, "/users");
    else { assert.equal(answer.links.length, 0); assert.match(answer.text, /Only the hostel owner/); }
  }
  const gate = await answerHostelQuestion(authenticatedDatabase("CARETAKER"), owner, false, screenshot, noProvider);
  assert.ok(typeof gate.text === "string"); assert.match(gate.text, /Caretaker access cannot approve student checkout/);
  const manager = await answerHostelQuestion(authenticatedDatabase("MANAGER"), owner, false, "Register a student", noProvider);
  assert.ok(typeof manager.text === "string"); assert.match(manager.text, /Only the hostel owner/); assert.equal("workflow" in manager, false);
});

test("tenants receive their own workflows and no management links", () => {
  const examples = [[screenshot, "/tenant/contact"], ["How do I add classes?", "/tenant/timetable"], ["How do I report going out?", "/tenant/movements"], ["How do I register a student account?", "/tenant/register"], ["How do I register a visitor?", "/tenant/visitors"]];
  for (const [q, href] of examples) assert.equal(answerSystemWorkflow(q, "TENANT")?.links[0]?.href, href, q);
  const tenantAdmission = answerSystemWorkflow(examples[3][0], "TENANT");
  assert.match(tenantAdmission?.text ?? "", /verifies and approves/);
  for (const topic of systemGuide("TENANT")) assert.ok(topic.href.startsWith("/tenant/") || topic.href === "/install", topic.href);
});

test("every main management module has guidance and all catalogue links point to implemented pages", () => {
  const guide = systemGuide("MANAGEMENT");
  for (const nav of visibleStaffNavigation("OWNER")) assert.ok(guide.some(t => t.href.split(/[?#]/)[0] === nav.href), nav.label);
  assert.equal(new Set(systemWorkflows.map(w => w.id)).size, systemWorkflows.length);
  for (const role of ["MANAGEMENT", "CARETAKER", "TENANT", "PUBLIC"] as const) for (const topic of systemGuide(role)) {
    const href = topic.href.split(/[?#]/)[0];
    const paths = [`src/app${href}/page.tsx`, `src/app/(app)${href}/page.tsx`];
    assert.ok(paths.some(path => existsSync(resolve(path))), `${topic.title}: ${href}`);
  }
});

test("guide search does not use substring or generic room matches as evidence", () => {
  const result = searchSystemGuide(systemGuide("MANAGEMENT"), "room zzzzz");
  assert.equal(result.length, 0);
  assert.equal(searchSystemGuide(systemGuide("MANAGEMENT"), "How do I upload room photos?")[0].href, "/website");
  assert.ok(searchSystemGuide(systemGuide("MANAGEMENT"), "Who has not checked out?").some(t => t.href === "/visitors?filter=OVERDUE"));
});
