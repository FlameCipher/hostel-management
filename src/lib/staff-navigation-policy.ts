export type HostelStaffRole = "OWNER" | "ADMIN" | "MANAGER" | "CARETAKER";

export type StaffNavigationLink = {
  href: string;
  label: string;
  section: string;
};

/** Navigation is guidance, not authorization. Every sensitive server route also
 * checks the authenticated role. Caretaker/security sees gate and operational tools
 * rather than finance, staff administration, messaging campaigns or exports.
 */
const links: StaffNavigationLink[] = [
  {href:"/services",label:"Service links",section:"Communication"},
  {href:"/dashboard",label:"Dashboard",section:"Overview"},
  {href:"/assistant",label:"System Assistant",section:"Overview"},
  {href:"/rooms",label:"Rooms",section:"Property operations"},
  {href:"/bookings",label:"Bookings",section:"Property operations"},
  {href:"/students",label:"Students",section:"Property operations"},
  {href:"/visitors",label:"Visitor gate",section:"Property operations"},
  {href:"/outings",label:"Student outings & late returns",section:"Property operations"},
  {href:"/safety",label:"Student SOS",section:"Property operations"},
  {href:"/occupancy",label:"Check-in / Check-out",section:"Property operations"},
  {href:"/students/registrations",label:"Tenant Registration",section:"Property operations"},
  {href:"/student-terms",label:"Student Terms",section:"Property operations"},
  {href:"/semesters",label:"Semesters",section:"Property operations"},
  {href:"/student-property",label:"Student Property",section:"Property operations"},
  {href:"/assets",label:"Hostel Assets",section:"Property operations"},
  {href:"/communications/inbox",label:"Student Inbox",section:"Communication"},
  {href:"/communications",label:"Communications",section:"Communication"},
  {href:"/communications/whatsapp",label:"WhatsApp",section:"Communication"},
  {href:"/notifications",label:"Reminders",section:"Communication"},
  {href:"/payments",label:"Payments",section:"Finance"},
  {href:"/expenses",label:"Expenses",section:"Finance"},
  {href:"/reports",label:"Reports",section:"Finance"},
  {href:"/website",label:"My Website",section:"Workspace settings"},
  {href:"/vacancy-card",label:"Vacancy Card",section:"Workspace settings"},
  {href:"/users",label:"Users & Permissions",section:"Workspace settings"},
  {href:"/gate-readiness",label:"Gate readiness",section:"Workspace settings"},
  {href:"/setup",label:"Hostel Setup",section:"Workspace settings"},
  {href:"/healthfix",label:"HealthFix",section:"Workspace settings"},
  {href:"/install",label:"Install App",section:"Workspace settings"},
  {href:"/account",label:"My Account",section:"Workspace settings"},
  {href:"/settings",label:"Settings",section:"Workspace settings"},
];

const caretakerVisible=new Set([
  "/visitors","/outings","/safety","/rooms","/occupancy","/assistant","/install","/account",
]);
const managerHidden=new Set(["/users","/healthfix","/gate-readiness","/students/registrations"]);
const caretakerSensitive=new Set(["/dashboard","/payments","/expenses","/reports",
  "/search","/notifications","/communications","/students/registrations",
  "/users","/setup","/healthfix","/website","/settings","/vacancy-card"]);
export function visibleStaffNavigation(role:HostelStaffRole):StaffNavigationLink[] {
  return links.filter(link=>role==="CARETAKER"?caretakerVisible.has(link.href):
    role==="MANAGER"?!managerHidden.has(link.href):true);
}
export function staffHome(role:HostelStaffRole) {
  return role==="CARETAKER"?"/visitors":"/dashboard";
}
export function staffCanViewFinance(role:HostelStaffRole) {
  return role!=="CARETAKER";
}
export function staffMayReviewGateReadiness(role:HostelStaffRole) {
  return role==="OWNER"||role==="ADMIN";
}
export function isCaretakerSensitivePath(path:string) {
  const exact=[...caretakerSensitive].sort((a,b)=>b.length-a.length);
  return exact.some(prefix=>path===prefix||path.startsWith(prefix+"/"));
}
export function staffNavActivePath(href:string,pathname:string) {
  return pathname===href||pathname.startsWith(href+"/");
}
