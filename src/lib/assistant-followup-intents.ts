import { normalizeAssistantQuestion, referencedAssistantRooms } from "./assistant-question";

/** Browser and server use the same rule; only a signed context can resolve it. */
export function isRoomFinanceFollowup(question: string): boolean {
  const q = normalizeAssistantQuestion(question).toLowerCase();
  if (!q || q.length > 1200 || referencedAssistantRooms(q).length) return false;
  const value = q.replace(/^(?:and\s+|okay[,\s]+|then\s+|what about\s+)/i, "");
  return /^(?:how much\s+(?:has|have|had|did|does|do)\s+(?:he|she|they|that\s+(?:student|resident|tenant))\s+(?:paid|pay|owe)|what(?:'s| is)\s+(?:his|her|their|that\s+(?:student|resident|tenant)'?s)\s+(?:balance|rent|payments?)|(?:has|have|did)\s+(?:he|she|they)\s+pa(?:y|id)|show\s+(?:me\s+)?(?:his|her|their)\s+(?:payments?|balance)|(?:his|her|their)\s+(?:payment|rent|balance))\b/i.test(value)
    || /^(?:payments?|paid|balance|receipts?)(?:\s+(?:(?:this|last|current|previous)\s+(?:month|week|year|semester)|today|yesterday))?[?!.]*$/i.test(value);
}
