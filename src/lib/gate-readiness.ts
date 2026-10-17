export type GateReadinessInput = {
  activeCaretakers: number;
  activeOwners: number;
  activeAdministrators: number;
  activeStudents: number;
  enabledTenantAccounts: number;
  pendingRegistrations: number;
  expectedVisits: number;
  recordedEntries: number;
  recordedExits: number;
  overdueExits: number;
  activeProperties: number;
};

export type GateReadinessStep = {
  code: string;
  title: string;
  status: "READY"|"ACTION_REQUIRED"|"NOT_VERIFIED";
  explanation: string;
  href: string;
};

const nonnegative=(value:number)=>Number.isSafeInteger(value)&&value>=0?value:0;

/** Read-only metadata readiness, NOT an electronic or on-site identity test.
 * Never invent an operator, enable an account, or fabricate visitor events.
 */
export function gateReadinessSummary(input:GateReadinessInput) {
  const data=Object.fromEntries(Object.entries(input).map(([key,value])=>[
    key,nonnegative(value),
  ])) as GateReadinessInput;
  const missingPortal=Math.max(0,data.activeStudents-data.enabledTenantAccounts);
  const steps:GateReadinessStep[]=[
    {code:"owners",title:"Authorized Owner/Admin available",
      status:data.activeOwners+data.activeAdministrators>0?"READY":"ACTION_REQUIRED",
      explanation:"Owner/Admin must control staff provisioning and verify resident identity.",
      href:"/users"},
    {code:"caretaker",title:"Dedicated gate operator account",
      status:data.activeCaretakers>0?"READY":"ACTION_REQUIRED",
      explanation:"Create a named CARETAKER / SECURITY login for an actual verified employee. Never share the Owner password.",
      href:"/users/new"},
    {code:"portal",title:"All active residents have verified portal access",
      status:data.activeStudents>0 && missingPortal===0?"READY":"ACTION_REQUIRED",
      explanation:missingPortal===0 && data.activeStudents>0
        ? "All recorded active residents have enabled portals. Confirm first sign-in independently."
        : `${missingPortal} of ${data.activeStudents} active residents still need portal activation. Review individual pending requests, independently verify identity and current rooms, then test sign-in. One active account does not complete hostel onboarding.`,
      href:"/students/registrations"},
    {code:"first-request",title:"First real tenant visitor request",
      status:data.expectedVisits+data.recordedEntries+data.recordedExits>0?"READY":"NOT_VERIFIED",
      explanation:"A signed-in resident must submit a genuine visit with informed visitor details.",
      href:"/visitors?filter=EXPECTED"},
    {code:"gate-entry",title:"First on-site verified entry",
      status:data.recordedEntries>0?"READY":"NOT_VERIFIED",
      explanation:"A human at the gate must verify a real visitor and host before recording check-in.",
      href:"/visitors?filter=EXPECTED"},
    {code:"gate-exit",title:"First on-site verified departure",
      status:data.recordedExits>0?"READY":"NOT_VERIFIED",
      explanation:"The same gate process must verify actual departure before recording check-out.",
      href:"/visitors?filter=INSIDE"},
    {code:"property",title:"An active hostel property",
      status:data.activeProperties>0?"READY":"ACTION_REQUIRED",
      explanation:"Visitors and gate roles operate only within an active authorized hostel property.",
      href:"/setup"},
  ];
  return {
    counts:{...data,missingPortal},
    steps,
    pendingVerification:steps.filter(s=>s.status!=="READY").length,
    needsGateOperator:data.activeCaretakers===0,
    safeForAutomatedActivation:false,
    verifiedOnSite:false, // Audit records alone cannot prove a physical on-site test.
  };
}
