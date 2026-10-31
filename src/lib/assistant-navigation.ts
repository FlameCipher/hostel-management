import type { PrismaClient } from "@/generated/prisma/client";
import { managedPropertyHost } from "./property-host-policy";
import { visibleStaffNavigation, type HostelStaffRole } from "./staff-navigation-policy";
import type { GuideRole } from "./system-guide";

export type StudentLink = { title: string; url: string };
const publicPaths = new Set(["/update-details", "/tenant/login", "/tenant/register"]);
export function safeStudentLink(value: unknown): value is StudentLink {
  if (!value || typeof value !== "object") return false;
  const link = value as StudentLink;
  if (typeof link.title !== "string" || typeof link.url !== "string") return false;
  try {
    const url = new URL(link.url);
    return url.protocol === "https:" && managedPropertyHost(url.hostname) === url.hostname && !url.port && !url.username && !url.password && !url.search && !url.hash && publicPaths.has(url.pathname);
  } catch { return false; }
}

export function studentLinkIntent(question: string): "update" | "login" | "register" | null {
  const q = question.toLowerCase();
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
  const aliases: Record<string, string> = { "student register": "/students", "student list": "/students", "student registration": "/students/registrations", "check in": "/occupancy", "check out": "/occupancy", "occupancy": "/occupancy", "student update": "/update-details", "update details": "/update-details", "student sign in": "/tenant/login", "student login": "/tenant/login" };
  const pages = role === "TENANT" ? [
    { label: "My account", href: "/tenant/account" }, { label: "My details", href: "/tenant/profile" },
    { label: "My visitors", href: "/tenant/visitors" }, { label: "My outings", href: "/tenant/movements" },
    { label: "My timetable", href: "/tenant/timetable" }, { label: "Contact management", href: "/tenant/contact" },
  ] : staffRole ? visibleStaffNavigation(staffRole) : [];
  const target = aliases[name];
  const page = pages.find(p => p.label.toLowerCase() === name || p.href === target);
  return page ?? (target && publicPaths.has(target) ? { label: "Student portal", href: target } : null);
}

export async function answerStudentLinks(database: PrismaClient, organizationId: string, intent: "update" | "login" | "register") {
  const properties = await database.property.findMany({ where: { organizationId, active: true, publicListing: true }, select: { name: true, customDomain: true }, take: 2 });
  const host = properties.length === 1 ? managedPropertyHost(properties[0].customDomain) : null;
  if (!host) return { mode: "guide" as const, text: "I could not verify a single published hostel address for this account. Confirm the hostel website before sharing a student link.", links: [] };
  const origin = "https://" + host;
  const primary = intent === "update" ? { title: "Update student details", url: origin + "/update-details" } : intent === "register" ? { title: "Request student access", url: origin + "/tenant/register" } : { title: "Student sign in", url: origin + "/tenant/login" };
  const shareLinks = [primary];
  const text = intent === "update"
    ? "Existing students can confirm and complete their details here:\n" + primary.url + "\n\nUse your registered name and phone number to update your existing record. Management reviews submitted changes. This does not create another student account or rent charge. Copy or share the link below."
    : primary.title + ":\n" + primary.url + (intent === "register" ? "\nFor students already enrolled by the hostel. Management must verify and approve portal access." : "\nUse your approved student account to sign in.");
  return { mode: "guide" as const, text, shareLinks, links: [] };
}
