import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ownerOperationLinks } from "../src/lib/owner-operations";

test("owner sees existing-account, receipt, and staff readiness without treating them as pending applications",()=>{
 const rows=ownerOperationLinks({inactivePortals:30,pendingApplications:0,pendingReceipts:30,activeCaretakers:0});
 assert.deepEqual(rows.map(x=>x.key),["accounts","receipts","caretaker"]);
 assert.match(rows[0].label,/30 active students? without portal access/);
 assert.equal(rows[0].href,"/communications/invitations/mobile");
 assert.equal(rows[1].href,"/payments?delivery=all");
 assert.equal(rows[2].href,"/users/new?role=CARETAKER");
 assert.doesNotMatch(rows.map(x=>x.label).join(" " ),/approved|delivered|missing|SOS enabled/i);
});
test("pending applications remain distinct, all-clear hides the worklist, counts are bounded",()=>{
 const rows=ownerOperationLinks({inactivePortals:2,pendingApplications:1,pendingReceipts:1,activeCaretakers:1});
 assert.deepEqual(rows.map(x=>x.key),["registration","accounts","receipts"]);
 assert.equal(rows[0].href,"/students/registrations");
 assert.deepEqual(ownerOperationLinks({inactivePortals:0,pendingApplications:0,pendingReceipts:0,activeCaretakers:1}),[]);
 assert.deepEqual(ownerOperationLinks({inactivePortals:-1,pendingApplications:NaN,pendingReceipts:0,activeCaretakers:1}),[]);
});
test("dashboard reads tenant-isolated scoped counts and owner-only summary",()=>{
 const page=readFileSync("src/app/(app)/dashboard/page.tsx","utf8");
 const view=readFileSync("src/app/(app)/dashboard/dashboard-view.tsx","utf8");
 assert.match(page,/canReviewOperations=session.role==="OWNER" \|\| session.role==="ADMIN"/);
 assert.match(page,/canReviewOperations \? db.student.count/);
 assert.match(page,/canReviewOperations \? db.tenantRegistration.count/);
 assert.match(page,/canReviewOperations \? db.payment.count/);
 assert.match(page,/canReviewOperations \? db.user.count/);
 assert.match(page,/organizationId:session.organizationId/);
 assert.match(page,/Math.max\(0,students-portalsEnabled\)/);
 assert.match(view,/props.canVerifyRegistrations && props.operations.length>0/);
 assert.match(view,/Account approvals remain individual/);
 assert.doesNotMatch(view,/activateInvitation\(|sendWhatsAppTemplate\(|deliverPaymentReceipt\(/);
});
