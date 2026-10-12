/** Read-only gate and visitor-policy checks. These guards never infer physical
 * presence from a planned time; only a staff-verified check-in/out is recorded.
 */
export type VisitorGateAction="APPROVE"|"DENY"|"CHECK_IN"|"CHECK_OUT"|"CANCEL";
export type VisitForGate={
  status:string;
  expectedArrival:Date;
  expectedDeparture:Date;
  checkedInAt:Date|null;
  checkedOutAt:Date|null;
  roomLabel:string;
  propertyId:string;
  studentId:string;
};
export type LiveVisitorHost={
  roomNumber:string;
  propertyId:string;
  studentId:string;
  active:boolean;
};

export function visitGatePreflight(
  visit:VisitForGate,
  action:VisitorGateAction,
  now:Date,
  host?:LiveVisitorHost|null,
):string|null{
  if(!Number.isFinite(now.getTime()))return "INVALID_CLOCK";
  if(action==="APPROVE"||action==="CHECK_IN"){
    if(!host?.active||host.studentId!==visit.studentId||host.propertyId!==visit.propertyId) {
      return "HOST_NO_LONGER_ELIGIBLE";
    }
    if(host.roomNumber.trim().toLocaleLowerCase()!==visit.roomLabel.trim().toLocaleLowerCase()) {
      return "HOST_ROOM_CHANGED";
    }
    if(!Number.isFinite(visit.expectedArrival.getTime())||
       !Number.isFinite(visit.expectedDeparture.getTime())||
       visit.expectedDeparture<=visit.expectedArrival||visit.expectedDeparture<=now){
      return "VISIT_WINDOW_EXPIRED";
    }
    if(action==="CHECK_IN"&&visit.expectedArrival.getTime()>now.getTime()+60*60_000){
      return "ARRIVAL_TOO_EARLY";
    }
    if(visit.checkedInAt||visit.checkedOutAt)return "INVALID_VISIT_HISTORY";
  }
  if(action==="CHECK_OUT"){
    if(!visit.checkedInAt||!Number.isFinite(visit.checkedInAt.getTime())||
      visit.checkedInAt.getTime()>now.getTime()||visit.checkedOutAt){
      return "CHECKOUT_HISTORY_INVALID";
    }
  }
  return null;
}

/** Pure count summary for one already-organization-scoped set of visitor rows.
 * "Inside" means CHECKED_IN and no recorded checkout, not observed physical presence.
 */
export function summarizeVisitOperations(
  visits:readonly {status:string;expectedArrival:Date;expectedDeparture:Date;checkedOutAt:Date|null}[],
  now:Date,
){
  return {
    expected:visits.filter(v=>v.status==="REQUESTED"||v.status==="APPROVED").length,
    insideUnconfirmed:visits.filter(v=>v.status==="CHECKED_IN"&&!v.checkedOutAt).length,
    departureOverdue:visits.filter(v=>v.status==="CHECKED_IN"&&!v.checkedOutAt&&v.expectedDeparture<now).length,
    expiredBeforeEntry:visits.filter(v=>(v.status==="REQUESTED"||v.status==="APPROVED")&&v.expectedDeparture<now).length,
    completed:visits.filter(v=>v.status==="CHECKED_OUT").length,
    total:visits.length,
  };
}
