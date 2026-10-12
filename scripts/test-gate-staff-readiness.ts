import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  visibleStaffNavigation,staffCanViewFinance,staffHome,
  staffMayReviewGateReadiness,isCaretakerSensitivePath,staffNavActivePath,
  type HostelStaffRole,
} from "../src/lib/staff-navigation-policy";
import {gateReadinessSummary} from "../src/lib/gate-readiness";

const roles:HostelStaffRole[]=["OWNER","ADMIN","MANAGER","CARETAKER"];
for(const role of roles){
  const nav=visibleStaffNavigation(role);
  assert.ok(nav.length>0);
  assert.ok(nav.some(x=>x.href==="/visitors"));
  const hrefs=nav.map(x=>x.href);
  assert.equal(hrefs.length,new Set(hrefs).size);
}
const caretaker=visibleStaffNavigation("CARETAKER");
assert.deepEqual(caretaker.map(x=>x.href).sort(),[
  "/visitors","/rooms","/occupancy","/assistant","/install","/account",
].sort());
for(const path of ["/payments","/expenses","/reports","/dashboard",
  "/search","/notifications","/users","/communications","/settings",
  "/healthfix","/students/registrations","/gate-readiness"]){
  assert.ok(!caretaker.some(x=>x.href===path),"Caretaker menu must exclude "+path);
}
assert.equal(staffHome("CARETAKER"),"/visitors");
assert.equal(staffHome("OWNER"),"/dashboard");
assert.equal(staffHome("MANAGER"),"/dashboard");
assert.equal(staffMayReviewGateReadiness("OWNER"),true);
assert.equal(staffMayReviewGateReadiness("ADMIN"),true);
assert.equal(staffMayReviewGateReadiness("MANAGER"),false);
assert.equal(staffMayReviewGateReadiness("CARETAKER"),false);
for(const role of ["OWNER","ADMIN","MANAGER"] as const)assert.equal(staffCanViewFinance(role),true);
assert.equal(staffCanViewFinance("CARETAKER"),false);
assert.equal(visibleStaffNavigation("MANAGER").some(x=>x.href==="/users"),false);
assert.equal(visibleStaffNavigation("MANAGER").some(x=>x.href==="/gate-readiness"),false);
assert.equal(visibleStaffNavigation("OWNER").some(x=>x.href==="/gate-readiness"),true);
assert.equal(staffNavActivePath("/visitors","/visitors?filter=EXPECTED"),false);
assert.equal(staffNavActivePath("/visitors","/visitors"),true);
assert.equal(staffNavActivePath("/visitors","/visitors/records"),true);
assert.equal(staffNavActivePath("/visitors","/visitor-other"),false);

for(const path of ["/payments","/payments/abc/receipt","/payments/abc/receipt/pdf",
  "/expenses","/expenses/new","/reports","/reports/export","/reports/print",
  "/dashboard","/users","/search","/notifications"]){
  assert.equal(isCaretakerSensitivePath(path),true,path);
}
for(const path of ["/visitors","/rooms","/account","/assistant","/install","/occupancy"]){
  assert.equal(isCaretakerSensitivePath(path),false,path);
}

const base={
  activeCaretakers:0,activeOwners:1,activeAdministrators:1,
  activeStudents:32,enabledTenantAccounts:1,pendingRegistrations:0,
  expectedVisits:0,recordedEntries:0,recordedExits:0,overdueExits:0,activeProperties:1,
};
const before=JSON.stringify(base);
const report=gateReadinessSummary(base);
assert.equal(report.counts.missingPortal,31);
assert.equal(report.needsGateOperator,true);
assert.equal(report.verifiedOnSite,false);
assert.equal(report.safeForAutomatedActivation,false);
assert.equal(report.steps.find(x=>x.code==="caretaker")?.status,"ACTION_REQUIRED");
assert.equal(report.steps.find(x=>x.code==="first-request")?.status,"NOT_VERIFIED");
assert.equal(report.steps.find(x=>x.code==="gate-entry")?.status,"NOT_VERIFIED");
assert.equal(report.steps.find(x=>x.code==="gate-exit")?.status,"NOT_VERIFIED");
assert.equal(JSON.stringify(base),before);
const withGate=gateReadinessSummary({
  ...base,activeCaretakers:2,recordedEntries:1,recordedExits:1,expectedVisits:2,
});
assert.equal(withGate.needsGateOperator,false);
assert.equal(withGate.steps.find(x=>x.code==="caretaker")?.status,"READY");
assert.equal(withGate.steps.find(x=>x.code==="gate-entry")?.status,"READY");
assert.equal(withGate.verifiedOnSite,false,"Database events cannot prove on-site verification.");

const read=(path:string)=>readFileSync(path,"utf8");
const serverRoleProtected=[
  "src/app/(app)/dashboard/page.tsx",
  "src/app/(app)/payments/page.tsx",
  "src/app/(app)/expenses/page.tsx",
  "src/app/(app)/expenses/new/page.tsx",
  "src/app/(app)/search/page.tsx",
  "src/app/(app)/payments/[id]/receipt/page.tsx",
  "src/app/(app)/reports/page.tsx",
  "src/app/(app)/reports/print/page.tsx",
];
for(const path of serverRoleProtected) {
  assert.ok(read(path).includes("requireStaffFinanceAccess"),
    "Server page must check role before exposing data: "+path);
}
for(const path of [
  "src/app/(app)/reports/export/route.ts",
  "src/app/(app)/payments/[id]/receipt/pdf/route.ts",
]) {
  const contents=read(path);
  assert.ok(contents.includes('session.role === "CARETAKER"'),path);
  assert.ok(contents.includes("403"),path);
}
assert.ok(read("src/app/(app)/occupancy/[id]/page.tsx").includes("{canReviewRent ? <>"),
  "Caretaker must not see ledger and rent adjustment details by opening occupancy URLs.");
assert.ok(read("src/components/app-shell.tsx").includes("visibleStaffNavigation"));
assert.ok(read("src/components/app-shell.tsx").includes('staffRole!=="CARETAKER"'));
assert.ok(read("src/app/(app)/gate-readiness/page.tsx").includes("staffMayReviewGateReadiness"));
assert.ok(read("src/app/(app)/students/page.tsx").includes('session.role === "CARETAKER"'),"Caretaker should not access personal student register.");
assert.ok(read("src/app/(app)/visitors/page.tsx").includes("hostRoomChanged=!room||"),"An absent host occupancy must block gate admission.");
console.log("Gate Staff & Operational Readiness: role menu, caretaker privacy, route guards, operational metrics and on-site verification boundaries passed.");
