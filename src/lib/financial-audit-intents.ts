/** Route only explicit management questions about financial integrity to a read-only page.
 * This does not query or change financial records from the AI chat.
 */
export function financialAuditNavigationRequest(question: string) {
  const text=question.trim().toLocaleLowerCase();
  const command=/^(show|open|list|find|check|audit|review|which|where|display|inspect|see)\b/i.test(text);
  const auditTopic=/\b(audit|anomal(?:y|ies)|discrepanc(?:y|ies)|mismatch(?:es)?|integrity|wrong\s+(?:rate|rent|charge)|incorrect\s+(?:rent|charge)|suspicious\s+payment)\b/i.test(text);
  const financialContext=/\b(financ(?:e|ial)|rent|room|charge|payment|billing|student|hostel|transfer|account|anomal(?:y|ies)|audit|integrity)\b/i.test(text);
  return command && auditTopic && financialContext;
}
