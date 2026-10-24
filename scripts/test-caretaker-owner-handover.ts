import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const ownerPage=readFileSync("src/app/(app)/users/new/page.tsx","utf8");
const form=readFileSync("src/components/user-form.tsx","utf8");
const action=readFileSync("src/app/(app)/users/actions.ts","utf8");
const service=readFileSync("src/lib/hostel-staff.ts","utf8");

test("only MMAMBUGUA caretaker has the documented local shift defaults; no password or staff identity is invented",()=>{
 assert.match(ownerPage,/defaultRole==="CARETAKER" && session.organizationId==="mama-mbugua-hostel" \? "06:00"/);
 assert.match(ownerPage,/defaultRole==="CARETAKER" && session.organizationId==="mama-mbugua-hostel" \? "22:00"/);
 assert.match(ownerPage,/role==="CARETAKER"\?"CARETAKER":"MANAGER"/);
 assert.match(form,/defaultValue=\{user\?\.dutyStart \?\? defaultDutyStart\}/);
 assert.match(form,/defaultValue=\{user\?\.dutyEnd \?\? defaultDutyEnd\}/);
 assert.doesNotMatch(ownerPage,/Emmanuel|254143040402|\bpasswordHash\b/);
});

test("the owner must explicitly verify caretaker identity and confirm both password entries",()=>{
 assert.match(form,/name="confirmStaffIdentity" type="checkbox" required/);
 assert.match(form,/name="passwordConfirmation"/);
 assert.match(form,/I have independently confirmed this employee's identity/);
 assert.match(action,/if\(password!==confirmation\)return \{error:"The passwords do not match/);
 assert.match(action,/if\(!id && form.get\("role"\)==="CARETAKER" && form.get\("confirmStaffIdentity"\)!=="on"\)/);
 assert.match(action,/saveHostelStaff\(db, session, id,/);
 assert.match(service,/actor\.sessionVersion !== session\.sessionVersion/);
 assert.match(service,/\["OWNER", "ADMIN"\]\.includes\(actor.role\)/);
 assert.match(service,/await hash\(password, 12\)/);
});

test("no background creation or automatic grant is introduced",()=>{
 assert.doesNotMatch(ownerPage,/useEffect|autoCreateUser|saveHostelStaff\(/);
 assert.doesNotMatch(form,/useEffect|autoSubmit\(/);
 assert.match(form,/type="checkbox"\/><span>Account is active/);
});
