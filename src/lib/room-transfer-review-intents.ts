/** Read-only AI shortcut to the hostel-scoped transfer case register.
 * Never interprets a chat command as approval to edit or recalculate rent.
 */
export function transferReviewNavigationRequest(question:string) {
  const text=question.trim().toLocaleLowerCase();
  return /^(show|open|list|review|audit|check|find|which|where|see|inspect)\b/.test(text) &&
    /\b(room transfers?|transfer history|transfer cases?|room movements?|moved rooms?|room changes?|move history|transfer records?)\b/.test(text);
}
