/**
 * Client navigation optimization only. Live ledger, visitor and registration
 * questions must always reach /api/assistant, where current DB role/scope is checked.
 */
export function occupancySearchShortcut(question:string):string|null {
 const value=question.trim();
 if(!/^(?:find|locate|search(?: for)?|open|show|where is)\b/i.test(value))return null;
 if(/(?:\b(?:unpaid|outstanding|owe|owing|owed|not paid|balance|deni|madeni|debtor|debtors|arrears|received|collected|collections?|payments?|pay|paid|income|receipts?|delivery|registrations?|pending|visitors?|guests?|checkout|check-out|departures?|overdue|caretakers?|occupants?|residents?|security|gate|vacant|vacancy)\b|hasn.t paid|haven.t paid)/i.test(value))return null;
 const room=value.match(/\broom\s*(?:number\s*)?(\d+[a-z]?)\b/i);
 const subject=room?.[1]??value
  .replace(/^(?:find|locate|search(?: for)?|open|show|where is)\s+(?:(?:me\s+)?(?:student|resident|tenant|room)(?:\s+number)?\s+)?/i,"")
  .replace(/[.!?]+$/,"").trim();
 return subject.length>=2&&subject.length<=80?subject:null;
}
