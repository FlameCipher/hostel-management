/** Conservative navigation hint. Sending a message remains a separate explicit action. */
export function receiptQueueNavigationRequest(question:string) {
  const q=question.trim().toLocaleLowerCase();
  return /^(show|open|list|find|view|check|which|where|display|who|what)\b/i.test(q)
    && /\b(receipt|receipts|risiti)\b/i.test(q)
    && /\b(pending|undelivered|unsent|failed|delivery|email|emailed|whatsapp|awaiting|queue)\b|not sent|not received|(?:have|has) not been (?:sent|emailed|delivered)|haven.t been (?:sent|emailed|delivered)/i.test(q);
}
