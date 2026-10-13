/**
 * Management question routing for totals and student composition.
 * No LLM or user-provided identity can authorize access to ledger/identity data.
 */
export function genderReportIntent(question:string):boolean {
 const q=question.trim().toLowerCase();
 if(!q||q.length>1200)return false;
 const demographic=/\b(?:gender|male|males|female|females|boys?|girls?|men|women)\b/i.test(q);
 const students=/\b(?:student|students|resident|residents|tenant|tenants|hostel|population|gender|boys?|girls?)\b/i.test(q);
 const reporting=/\b(?:how many|count|number|total|breakdown|statistics|stats|ratio|distribution|gender|composition|percentage)\b/i.test(q);
 return demographic&&students&&reporting;
}
export type BalanceIntent="outstanding"|"bank-unavailable"|null;
export function financialBalanceIntent(question:string):BalanceIntent {
 const q=question.trim().toLowerCase();
 if(!q||q.length>1200)return null;
 // Pronouns or a named owner may indicate a private account, not the hostel total.
 if(/\b(?:his|her|their)\s+(?:outstanding\s+)?balance\b|\b(?:student|tenant|resident)(?:\u0027s|’s)\s+balance\b/i.test(q))return null;
 if(/\b(?:bank|account balance|mpesa balance|m-pesa balance|cash balance|wallet balance)\b/i.test(q)
     && /\b(?:balance|remaining|left|money)\b/i.test(q))return"bank-unavailable";
 if(/\b(?:balance|balances|outstanding|arrears|debt|debts|unpaid|owing|owed|due|remaining)\b/i.test(q)&&
    /\b(?:balance|total|how much|what|show|give|outstanding|arrears|debt|owing|owed|remaining|unpaid|due)\b/i.test(q)){
   // Personal account questions are handled by name/room lookups ahead of this.
   if(/^(?:who|which|list(?: all)?|find|names?|nani)\b/.test(q)&&!/\b(?:total|sum|amount|how much)\b/.test(q))return null;
   if(/\b(?:how much|what(?:'s| is)|total|sum|amount|calculate|overall|aggregate|all|show|give)\b/.test(q)||
      /^(?:balance|outstanding|remaining|arrears|debt)(?:\s|$)/.test(q))return"outstanding";
 }
 return null;
}
/** A follow-up without a person/room refers to signed context ONLY, never to an arbitrary last record. */
export function contextualBalanceFollowup(question:string):boolean {
 const q=question.trim().toLowerCase().replace(/[?.!]+$/g,"").trim();
 if(!q||q.length>180||/\b(?:hostel|all|overall|total|bank|mpesa|m-pesa|room\s*\d+)\b/.test(q))return false;
 return /^(?:(?:and|then|so)\s+)?(?:how much is (?:the |his |her |their )?balance|what(?:'s| is) (?:the |his |her |their )?balance|how much (?:is )?(?:still )?(?:owed|owing|remaining)|(?:his|her|their) balance|balance due)$/.test(q);
}
