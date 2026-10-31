/** Shared, deterministic wording cleanup. Never fuzzy-match a student or room ID. */
export function normalizeAssistantQuestion(question: string): string {
  let value = question.trim().replace(/\s+/g, " ")
    .replace(/\b(who|what|where|how|hasn|haven|isn|aren|don|doesn|didn|can|couldn|wouldn|wasn|weren|it|that|he|she|they|i)’/gi, "$1'")
    .replace(/\b(?:room|rm|rom)\s*(?:(?:number|no\.?)\s*|#\s*)?([0-9]{1,5}[a-z]?)(?![\w-])/gi, (_, number: string) => "room " + number.toUpperCase());
  // Only remove a leading conversational wrapper; names and amounts stay intact.
  for (let i = 0; i < 3; i++) {
    value = value.replace(/^(?:please|kindly)[, ]+/i, "")
      .replace(/^(?:can|could|would|will) you\s+(?:please\s+)?/i, "")
      .replace(/^tell me\s+(?=who\b|which\b|where\b|what\b|how\b)/i, "");
  }
  return value;
}

export function referencedAssistantRooms(question: string): string[] {
  return [...new Set([...normalizeAssistantQuestion(question).matchAll(/\broom\s+([0-9]{1,5}[A-Z]?)(?![\w-])/gi)].map(match => match[1].toUpperCase()))];
}
