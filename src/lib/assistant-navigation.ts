import type { PrismaClient } from "@/generated/prisma/client";
import { managedPropertyHost } from "./property-host-policy";
import { visibleStaffNavigation, type HostelStaffRole } from "./staff-navigation-policy";
import type { GuideRole } from "./system-guide";

export type StudentLink = { title: string; url: string };
export const publicServicePages = [
  { title: "New students: apply for accommodation", path: "/book", description: "New applicants request a room. Management reviews the application before admission." },
  { title: "Existing students: request portal access", path: "/tenant/register", description: "Students already enrolled by management request access to their existing record." },
  { title: "Existing students: update details", path: "/update-details", description: "Confirm and complete an existing student record and guardian details." },
  { title: "Student sign in", path: "/tenant/login", description: "Sign in to an approved student account." },
  { title: "Pay rent with M-Pesa / Pesapal", path: "/pay-rent", description: "Student payment entry page. Parents use the individual payment request created for the correct student and charge." },
];
const publicPaths = new Set(publicServicePages.map(page => page.path));
export function safeStudentLink(value: unknown): value is StudentLink {
  if (!value || typeof value !== "object") return false;
  const link = value as StudentLink;
  if (typeof link.title !== "string" || typeof link.url !== "string") return false;
  try {
    const url = new URL(link.url);
    return url.protocol === "https:" && managedPropertyHost(url.hostname) === url.hostname && !url.port && !url.username && !url.password && !url.search && !url.hash && publicPaths.has(url.pathname);
  } catch { return false; }
}

export type StudentLinkIntent = "update" | "login" | "register" | "new" | "pay" | "all";
export function studentLinkIntent(question: string): StudentLinkIntent | null {
  const q = question.toLowerCase();
  if (/\b(?:link|links|url|share|copy|directory)\b/.test(q) && /\b(?:all|services|directory|new and existing|new\/existing)\b/.test(q)) return "all";
  if (/\b(?:link|links|url|share|copy)\b/.test(q) && /\b(?:pay|payment|payments|pesapal|mpesa|m-pesa)\b/.test(q)) return "pay";
  if (/\bnew\s+(?:student|tenant|applicant)s?\b/.test(q) && /\b(?:link|links|url|share|copy)\b/.test(q)) return "new";
  if (/\b(?:payments?|receipts?|balance|rent|delete|remove|merge|password)\b/.test(q)) return null;
  if (!/\b(?:students?|tenants?|residents?|my|update-details)\b/.test(q)) return null;
  if (/\b(?:update|complete|confirm|correct)\b/.test(q) && /\b(?:details|information|records?|profile|account)\b/.test(q) && !/\b(?:approve|reject|pending|review requests)\b/.test(q)) return "update";
  if (!/\b(?:link|links|url|address|share|copy|forward)\b/.test(q)) return null;
  if (/\b(?:login|log in|sign in|signin|portal)\b/.test(q)) return "login";
  if (/\b(?:register|registration|activate|access|signup|sign up)\b/.test(q)) return "register";
  return null;
}

// Only exact page names are navigation commands. Record questions, names and
// financial actions continue through their existing protected handlers.
export function requestedPageName(question: string): string | null {
  if (/\b(?:link|links|copy|share|forward)\b/i.test(question)) return null;
  return /^(?:please\s+)?(?:open|take me to|go to|navigate to|show me)\s+(?:the\s+)?(.+?)(?:\s+page)?[.!?]*$/i.exec(question.trim())?.[1].toLowerCase() ?? null;
}
export function assistantPage(question: string, role: GuideRole, staffRole?: HostelStaffRole) {
  const name = requestedPageName(question);
  if (!name) return null;
  const aliases: Record<string, string> = { "pesapal": "/payments/requests", "payment requests": "/payments/requests", "mpesa": "/payments/requests", "m-pesa": "/payments/requests", "service links": "/services", "unpaid pdf": "/reports/unpaid", "student register": "/students", "student list": "/students", "student registration": "/students/registrations", "check in": "/occupancy", "check out": "/occupancy", "occupancy": "/occupancy", "student update": "/update-details", "update details": "/update-details", "student sign in": "/tenant/login", "student login": "/tenant/login" };
  const pages = role === "TENANT" ? [
    { label: "My account", href: "/tenant/account" }, { label: "My details", href: "/tenant/profile" },
    { label: "My visitors", href: "/tenant/visitors" }, { label: "My outings", href: "/tenant/movements" },
    { label: "My timetable", href: "/tenant/timetable" }, { label: "Contact management", href: "/tenant/contact" },
  ] : staffRole ? [...visibleStaffNavigation(staffRole), ...(role === "MANAGEMENT" ? [{label:"Payment requests",href:"/payments/requests"},{label:"Unpaid staff PDF",href:"/reports/unpaid"}] : [])] : [];
  const target = aliases[name];
  const page = pages.find(p => p.label.toLowerCase() === name || p.href === target);
  return page ?? (target && publicPaths.has(target) ? { label: "Student portal", href: target } : null);
}

export async function answerStudentLinks(database: PrismaClient, organizationId: string, intent: StudentLinkIntent) {
  const properties = await database.property.findMany({ where: { organizationId, active: true, publicListing: true }, select: { name: true, customDomain: true }, take: 2 });
  const host = properties.length === 1 ? managedPropertyHost(properties[0].customDomain) : null;
  if (!host) return { mode: "guide" as const, text: "I could not verify a single published hostel address for this account. Confirm the hostel website before sharing a student link.", links: [] };
  const origin = "https://" + host;
  if (["new", "pay", "all"].includes(intent)) {
    const pages = publicServicePages.filter(page => intent === "all" || page.path === (intent === "new" ? "/book" : "/pay-rent"));
    return { mode: "guide" as const, text: pages.map(page => page.title + "\n" + page.description + "\n" + origin + page.path).join("\n\n") + "\n\nUse Open page, Copy link or Share below. A payment link does not itself send an M-Pesa prompt or confirm payment.", shareLinks: pages.map(page => ({ title: page.title, url: origin + page.path })), links: [] };
  }
  const primary = intent === "update" ? { title: "Update student details", url: origin + "/update-details" } : intent === "register" ? { title: "Request student access", url: origin + "/tenant/register" } : { title: "Student sign in", url: origin + "/tenant/login" };
  const shareLinks = [primary];
  const text = intent === "update"
    ? "Existing students can confirm and complete their details here:\n" + primary.url + "\n\nUse your registered name and phone number to update your existing record. Management reviews submitted changes. This does not create another student account or rent charge. Copy or share the link below."
    : primary.title + ":\n" + primary.url + (intent === "register" ? "\nFor students already enrolled by the hostel. Management must verify and approve portal access." : "\nUse your approved student account to sign in.");
  return { mode: "guide" as const, text, shareLinks, links: [] };
}
