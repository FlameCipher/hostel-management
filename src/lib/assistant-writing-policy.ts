export function writingIntent(question: string) {
  return /\b(?:rewrite|rephrase|polish|translate|spelling|grammar|tafsiri|rekebisha)\b/i.test(question) || (/\b(?:correct my|correct this)\b/i.test(question) && /\b(?:message|text|email|letter)\b/i.test(question)) || (/\b(?:write|draft|compose|andika)\b/i.test(question) && /\b(?:english|kiswahili|swahili)\b/i.test(question));
}
export function writingLanguage(question: string): "English" | "Kiswahili" {
  return /\b(?:kiswahili|swahili)\b/i.test(question) ? "Kiswahili" : "English";
}
