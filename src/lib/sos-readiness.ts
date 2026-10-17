/** An evidence-first overview, not an SOS activation control. */
export type SOSReadinessInput={
  pilotEnabled:boolean;
  activeStudents:number;
  enabledTenantPortals:number;
  activeCaretakers:number;
  activeOwnersAndAdmins:number;
  activeProperties:number;
  openAlerts:number;
  unacknowledgedAlerts:number;
  oldestUnacknowledgedMinutes:number|null;
  lastResponseEvidence:Date|null;
};
type Check={code:string;title:string;status:"ACTION_REQUIRED"|"NOT_VERIFIED"|"RECORDED";detail:string;href:string};
export function sosReadinessSummary(x:SOSReadinessInput,now=new Date()){
  const safe=(v:number)=>Number.isSafeInteger(v)&&v>=0?v:0;
  const activeStudents=safe(x.activeStudents);
  const portals=Math.min(activeStudents,safe(x.enabledTenantPortals));
  const caretaker=safe(x.activeCaretakers);
  const managers=safe(x.activeOwnersAndAdmins);
  const activeProperties=safe(x.activeProperties);
  const open=safe(x.openAlerts),unacknowledged=Math.min(open,safe(x.unacknowledgedAlerts));
  const minutes=x.oldestUnacknowledgedMinutes;
  const delayed=unacknowledged>0&&minutes!==null&&Number.isFinite(minutes)&&minutes>5;
  const evidenceAge=x.lastResponseEvidence&&x.lastResponseEvidence.getTime()<=now.getTime()?now.getTime()-x.lastResponseEvidence.getTime():null;
  const evidenceIsRecent=evidenceAge!==null&&evidenceAge<=30*86400000;
  const checks:Check[]=[
    {code:"pilot",title:"SOS submission switch",status:x.pilotEnabled?"RECORDED":"ACTION_REQUIRED",
      detail:x.pilotEnabled?"Configured ON for this organization; this is not proof that anyone receives or responds to alerts.":"Pilot is OFF. Only authorize activation after named responders, real drills and escalation channels are verified.",href:"/safety"},
    {code:"responders",title:"Named security/caretaker responders",status:caretaker>0?"NOT_VERIFIED":"ACTION_REQUIRED",
      detail:caretaker>0?caretaker+" active caretaker accounts exist. On-call duty, shift coverage, notification delivery and physical response are still unverified.":"No active caretaker account is recorded. Provision real staff individually and verify they can respond on-site.",href:"/users/new?role=CARETAKER"},
    {code:"management",title:"Owner or admin coverage",status:managers>0?"NOT_VERIFIED":"ACTION_REQUIRED",
      detail:managers>0?managers+" owner/admin accounts exist. Being an account holder does not prove someone is currently on call.":"No active owner/admin responder is recorded; incidents cannot be reliably closed by an authorized operator.",href:"/users"},
    {code:"student-access",title:"Existing student access",status:activeStudents>0&&portals===activeStudents?"RECORDED":"ACTION_REQUIRED",
      detail:portals+" of "+activeStudents+" active students have enabled tenant portals. Others cannot submit a signed-in SOS; they still need emergency phone access.",href:"/students/registrations"},
    {code:"property",title:"Active hostel property",status:activeProperties>0?"RECORDED":"ACTION_REQUIRED",
      detail:activeProperties>0?activeProperties+" active hostel properties are in the organization. Property configuration does not verify a staffed gate.":"No active property is recorded.",href:"/website"},
    {code:"response-evidence",title:"Real phone and responder acceptance",status:"NOT_VERIFIED",
      detail:(evidenceIsRecent?"A recent SOS response audit record exists, but it does not establish that a physical phone-to-staff drill, reliable push/call escalation, and trained shift coverage passed.":"No recent response acknowledgement record proves full phone-to-staff acceptance.")+
      " Test an explicitly marked exercise on two real devices, log the follow-up and verify the escalation route. Never mark a simulated case as a real emergency response.",href:"/safety"},
    {code:"delivery",title:"Reliable emergency alert notification",status:"NOT_VERIFIED",
      detail:"An opted-in staff phone may get best-effort SOS pushes and Owner/Admin escalation after five and fifteen minutes through the scheduled worker. A push-provider acceptance does not prove device display, reading or a human response. No verified phone/SMS fallback, staffed shift or emergency drill is established; never promise continuous monitoring.",href:"/safety"},
    {code:"backlog",title:"Unacknowledged SOS queue",status:unacknowledged>0?"ACTION_REQUIRED":"RECORDED",
      detail:unacknowledged>0?unacknowledged+" unacknowledged of "+open+" open/acknowledged cases."+(delayed?" Oldest is over 5 minutes old. Escalate immediately using direct contact.":" Follow up immediately."):
      open+" open or acknowledged cases; no presently unacknowledged case was found. This is not proof that all students are safe.",href:"/safety"},
  ];
  return {
    activeStudents,portals,caretaker,managers,open,unacknowledged,
    status:x.pilotEnabled?"PILOT_ENABLED_BUT_UNVERIFIED":"PILOT_OFF",
    checks,actionRequired:checks.filter(c=>c.status==="ACTION_REQUIRED").length,
    notVerified:checks.filter(c=>c.status==="NOT_VERIFIED").length,
    verifiedEmergencyService:false,
    summary:x.pilotEnabled?"SOS pilot is configured ON, but staffed emergency delivery and rescue readiness are NOT verified.":"SOS pilot remains OFF until real responders, devices and escalation are independently accepted.",
  };
}
