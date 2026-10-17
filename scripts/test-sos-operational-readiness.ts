import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import {sosReadinessSummary,type SOSReadinessInput} from "../src/lib/sos-readiness";
const now=new Date("2026-10-17T08:00:00Z");
const baseline:SOSReadinessInput={
 pilotEnabled:false,activeStudents:32,enabledTenantPortals:1,
 activeCaretakers:0,activeOwnersAndAdmins:1,
 activeProperties:1,openAlerts:0,unacknowledgedAlerts:0,
 oldestUnacknowledgedMinutes:null,lastResponseEvidence:null
};
test("SOS pilot OFF, unstaffed gate and limited portals cannot be presented as ready",()=>{
 const r=sosReadinessSummary(baseline,now);
 assert.equal(r.status,"PILOT_OFF");
 assert.equal(r.verifiedEmergencyService,false);
 assert.match(r.summary,/OFF/);
 assert.match(r.checks.find(x=>x.code==="responders")?.detail??"",/No active caretaker account/);
 assert.match(r.checks.find(x=>x.code==="student-access")?.detail??"",/1 of 32/);
 assert.equal(r.checks.find(x=>x.code==="student-access")?.status,"ACTION_REQUIRED");
 assert.equal(r.checks.find(x=>x.code==="response-evidence")?.status,"NOT_VERIFIED");
 assert.equal(r.checks.find(x=>x.code==="delivery")?.status,"NOT_VERIFIED");
});
test("ON flag and nonzero staff count NEVER assert real emergency operational acceptance",()=>{
 const r=sosReadinessSummary({...baseline,pilotEnabled:true,activeCaretakers:4,enabledTenantPortals:32,lastResponseEvidence:now},now);
 assert.equal(r.status,"PILOT_ENABLED_BUT_UNVERIFIED");
 assert.equal(r.verifiedEmergencyService,false);
 assert.match(r.summary,/NOT verified/i);
 assert.equal(r.checks.find(x=>x.code==="responders")?.status,"NOT_VERIFIED");
 assert.equal(r.checks.find(x=>x.code==="delivery")?.status,"NOT_VERIFIED");
 assert.match(r.checks.find(x=>x.code==="response-evidence")?.detail??"",/does not establish/);
});
test("current unacknowledged SOS always triggers human action; stale queue requires escalation",()=>{
 const r=sosReadinessSummary({...baseline,openAlerts:3,unacknowledgedAlerts:2,oldestUnacknowledgedMinutes:11},now);
 const backlog=r.checks.find(x=>x.code==="backlog");
 assert.equal(backlog?.status,"ACTION_REQUIRED");
 assert.match(backlog?.detail??"",/2 unacknowledged of 3/);
 assert.match(backlog?.detail??"",/over 5 minutes/);
 assert.match(backlog?.detail??"",/Escalate immediately/);
});
test("closed or acknowledged cases do not invent student safety or actual rescue",()=>{
 const r=sosReadinessSummary({...baseline,openAlerts:1,unacknowledgedAlerts:0},now);
 const backlog=r.checks.find(x=>x.code==="backlog");
 assert.equal(backlog?.status,"RECORDED");
 assert.match(backlog?.detail??"",/not proof that all students are safe/);
});
test("defensive summaries never inflate resident access or show impossible backlog",()=>{
 const r=sosReadinessSummary({...baseline,activeStudents:2,enabledTenantPortals:33,openAlerts:1,unacknowledgedAlerts:14},now);
 assert.equal(r.portals,2);assert.equal(r.unacknowledged,1);
 assert.equal(r.verifiedEmergencyService,false);
});
test("owner page uses same-hostel database queries and never changes incident status",()=>{
 const page=readFileSync("src/app/(app)/gate-readiness/page.tsx","utf8");
 assert.match(page,/staffMayReviewGateReadiness\(session\.role\)/);
 assert.match(page,/sosReadinessSummary/);
 assert.match(page,/sosPilotEnabled\(organizationId\)/);
 assert.match(page,/db\.safetyAlert\.count\(\{where:\{organizationId,status:"OPEN"\}\}\)/);
 assert.match(page,/SOS emergency response operational readiness/);
 assert.match(page,/read-only/);
 assert.doesNotMatch(page,/safetyAlert\.(create|update|delete)/);
 assert.doesNotMatch(page,/HOSTEL_SOS_ENABLED\s*=\s*["']true/);
});
