import type { GuideRole } from "./system-guide";

/** Deterministic navigation only. Sending and exports still require server-authorized review. */
export function assistantServiceAction(question: string, role: GuideRole) {
  const q = question.toLowerCase();
  const unpaid = /\b(?:unpaid|not paid|not cleared|outstanding|overdue|arrears)\b|hasn.t paid|haven.t paid/.test(q);
  const report = (unpaid && /\b(?:pdf|export)\b/.test(q)) || (/\b(?:share|send)\b/.test(q) && /\b(?:staff|caretaker)\b/.test(q) && unpaid);
  const directory = /^(?:please\s+)?(?:open|show|give|list).*\b(?:service directory|all services|all links|service links)\b/.test(q);
  const message = /\b(?:send|message|notify|broadcast)\b/.test(q) && /\b(?:students?|tenants?|everyone|male|female|selected)\b/.test(q);
  if (!report && !directory && !message) return null;
  if (role !== "MANAGEMENT") return report || message ? { mode: "guide" as const, text: "Tenant broadcasts and financial PDF exports require management access.", links: [] } : null;
  const href = report ? "/reports/unpaid" : directory ? "/services" : unpaid ? "/reports/arrears" : /\bfemale\b/.test(q) ? "/communications?audience=FEMALE" : /\bmale\b/.test(q) ? "/communications?audience=MALE" : /\b(?:all|everyone)\b/.test(q) ? "/communications?audience=ALL" : "/communications?audience=SELECTED";
  const title = report ? "Unpaid balances PDF for staff" : directory ? "Service links" : unpaid ? "Rent payment demands" : "Tenant messages";
  return { mode: "guide" as const, text: report ? "Open the staff report, review the balances and choose an active staff or caretaker contact. Generate the private PDF, then share it as a document through WhatsApp. No report has been sent." : directory ? "Open the service directory for copyable student links and the service pages available to your role." : "Choose and review the recipients and message in the communication screen. Overdue demands exclude approved payment extensions. No message has been sent.", links: [{ title, href, action: "Open " + title }], ...(/^\s*(?:please\s+)?(?:open|go to|take me to)\b/.test(q) ? { navigateTo: href } : {}) };
}
