import assert from "node:assert/strict";
import {
  comparablePhone,registrationIdentityKey,registrationReviewLabels,
  triageTenantRegistrations,type RegisteredTenant,type ReviewRegistration,
} from "../src/lib/tenant-registration-triage";

const day=(time:string)=>new Date(time);
const now=day("2026-10-16T10:00:00Z");
const req=(id:string,name:string,phone:string,room:string,date:string,
  org="hostel-A",property="property-A"):ReviewRegistration=>({
    id,organizationId:org,propertyId:property,fullName:name,phone,
    roomNumber:room,createdAt:day(date),
    expiresAt:day("2026-10-20T10:00:00Z"),status:"PENDING",
  });
const student=(id:string,name:string,phone:string,room:string,
  options?:Partial<RegisteredTenant>):RegisteredTenant=>({
    id,organizationId:"hostel-A",fullName:name,phone,
    status:"ACTIVE",portalEnabled:false,portalPasswordHash:null,
    portalLastLoginAt:null,portalInviteBlocked:false,
    occupancies:[{status:"ACTIVE",room:{number:room,propertyId:"property-A"}}],
    ...options,
  });
const students=[
  student("sheila","SHEILA NYABOKE MOTWANA","254712345678","54"),
  student("joseph","Joseph Omesa Oirere","254711111111","24"),
  student("activated","Portal Student","254733333333","5",{portalEnabled:true}),
  student("other-org","Unknown Stranger","254722222222","61",{organizationId:"other-hostel"}),
  student("inactive","Former Student","254744444444","40",{status:"CHECKED_OUT"}),
];
const requests=[
  req("a","  sheila   nyaboke motwana  ","0712345678","54","2026-10-13T10:00:00Z"),
  req("b","SHEILA NYABOKE MOTWANA","+254712345678","54","2026-10-14T10:00:00Z"),
  req("c","JOSEPH omesa OIRERE","0711111111","23","2026-10-13T14:00:00Z"),
  req("d","Joseph Omesa Oirere","254711111111","24","2026-10-15T09:00:00Z"),
  req("e","Portal Student","254733333333","5","2026-10-13T14:00:00Z"),
  req("f","Unknown Stranger","254722222222","61","2026-10-13T15:00:00Z"),
  req("g","Former Student","254744444444","40","2026-10-13T16:00:00Z"),
  {...req("h","Expired Example","254799999999","8","2026-10-13T18:00:00Z"),
    expiresAt:day("2026-10-15T10:00:00Z")},
];
const before=JSON.stringify({requests,students});
const triage=triageTenantRegistrations(requests,students,()=>"KE",now);
assert.equal(triage.counts.requests,8);
assert.equal(triage.counts.identities,6);
assert.equal(triage.counts.exactEligible,3);
assert.equal(triage.counts.blocked,5);
assert.equal(triage.counts.repeatSubmissions,2);
assert.equal(triage.counts.duplicateApplicants,2);
assert.equal(triage.counts.conflictingRooms,1);
assert.equal(triage.counts.expired,1);
assert.equal(triage.results.find(x=>x.request.id==="a")?.kind,"EXACT_MATCH");
assert.equal(triage.results.find(x=>x.request.id==="b")?.kind,"EXACT_MATCH");
assert.equal(triage.results.find(x=>x.request.id==="c")?.kind,"WRONG_ROOM");
assert.equal(triage.results.find(x=>x.request.id==="d")?.kind,"EXACT_MATCH");
assert.equal(triage.results.find(x=>x.request.id==="e")?.kind,"ALREADY_ENABLED");
assert.equal(triage.results.find(x=>x.request.id==="f")?.kind,"UNKNOWN_IDENTITY",
  "A matching student in a different hostel must not be eligible.");
assert.equal(triage.results.find(x=>x.request.id==="g")?.kind,"INELIGIBLE");
assert.equal(triage.results.find(x=>x.request.id==="h")?.kind,"EXPIRED");
const sheila=triage.groups.find(g=>g.phone==="0712345678");
assert.equal(sheila?.submissions.length,2);
assert.equal(sheila?.conflictingRooms,false);
assert.deepEqual(sheila?.submissions.map(x=>x.request.id),["b","a"]);
const joseph=triage.groups.find(g=>g.fullName.toLowerCase()==="joseph omesa oirere");
assert.deepEqual(joseph?.rooms,["23","24"]);
assert.equal(joseph?.conflictingRooms,true);
assert.equal(joseph?.submissions[0].request.id,"d");
assert.deepEqual(triage.results.find(x=>x.request.id==="d")?.matchingStudentIds,["joseph"]);
assert.notEqual(registrationIdentityKey(requests[0],"KE"),
  registrationIdentityKey({...requests[0],propertyId:"property-B"},"KE"));
assert.equal(comparablePhone("0712 345 678","KE"),"254712345678");
assert.equal(comparablePhone("+254712345678","KE"),"254712345678");
assert.notEqual(comparablePhone("0712 345 678","GB"),"254712345678");
assert.equal(registrationReviewLabels.EXACT_MATCH.length>10,true);
assert.equal(JSON.stringify({requests,students}),before,
  "Registration triage must never alter submitted data or activate anyone.");

const noRoom=triageTenantRegistrations([
  req("x","Joseph Omesa Oirere","254711111111","24","2026-10-15T09:00:00Z","hostel-A","property-B"),
],students,()=>"KE",now);
assert.equal(noRoom.results[0].kind,"WRONG_ROOM");

const blocked=triageTenantRegistrations([
  req("y","Portal Student","254733333333","5","2026-10-15T09:00:00Z"),
],[student("portal","Portal Student","254733333333","5",{
  portalEnabled:false,portalPasswordHash:"existing-hash",
})],()=>"KE",now);
assert.equal(blocked.results[0].kind,"INELIGIBLE");

const sharedPhone=triageTenantRegistrations([
  req("one","Resident One","0712345678","24","2026-10-14T09:00:00Z"),
  req("two","Different Resident","+254712345678","25","2026-10-15T09:00:00Z"),
  req("other-hostel","Foreign Tenant","0712345678","7","2026-10-15T09:00:00Z","hostel-B","property-B"),
],students,()=> "KE",now);
assert.equal(sharedPhone.counts.conflictingPhoneGroups,2);
assert.equal(sharedPhone.groups.filter(g=>g.conflictingPhoneClaims).length,2);
assert.equal(sharedPhone.groups.find(g=>g.fullName==="Foreign Tenant")?.conflictingPhoneClaims,false);
assert.equal(triage.groups.every(g=>g.conflictingPhoneClaims===false),true,
  "Distinct legitimate phones must not receive a conflict warning.");
console.log("Tenant registration triage: exact matches, duplicates, conflicting rooms, cross-hostel protection, expired and inactive accounts passed.");
