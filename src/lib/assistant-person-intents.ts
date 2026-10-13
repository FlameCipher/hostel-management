/**
 * Interpret person-finding questions before generic hostel knowledge or vacancy
 * intents. The text is merely a search term, never an account selector.
 */
export type PersonSearchIntent={kind:"student-search";name:string;asksAvailability:boolean};
const NAME=/^[\p{L}][\p{L}\p{M}.'’\- ]{1,99}$/u;
const stopwords=/^(?:rooms?|hostels?|beds?|prices?|rates?|rent|visitor|visitors|students?|tenants?|guardians?|owners?|staff|caretakers?|security|gate|office|management|vacancies|availability|anyone|somebody|someone|everybody|everyone|one|ones|them|they|he|she|there|here|today|tomorrow|yesterday|payments?|receipts?|balances?|accounts?)$/i;
function personName(raw:string):string|null {
  const value=raw.replace(/\s+/g," ").trim().replace(/[?!.]+$/,"").trim();
  if(value.length<2||value.length>100||!NAME.test(value)||stopwords.test(value))return null;
  if(value.split(" ").length>6)return null;
  return value;
}
export function personSearchIntent(question:string):PersonSearchIntent|null {
 const q=question.trim();if(!q||q.length>1200)return null;
 // Avoid stealing a private finance question from the dedicated finance reader.
 if(/\b(?:paid|payment|pay|rent|arrears|balance|owe|owing|debtor|receipt|invoice|collected)\b/i.test(q))return null;
 const patterns=[
  /^(?:i(?:'m| am)?|am|we(?:'re| are)?)\s+(?:looking|searching)\s+for\s+(?:a\s+)?(?:student\s+|tenant\s+|resident\s+|person\s+)?(.+)$/i,
  /^(?:find|locate|search(?: for)?|look(?:ing)? for|show me|show|where is|where's)\s+(?:student\s+|tenant\s+|resident\s+|person\s+)?(.+)$/i,
  /^(?:which|what)\s+(.+?)\s+(?:is|are)\s+(?:available|active|registered|here|staying|checked in)\??$/i,
  /^(?:is|are)\s+(.+?)\s+(?:available|active|registered|here|staying|checked in)\??$/i,
  /^(?:do we have|is there|are there)\s+(?:a\s+)?(?:student\s+|tenant\s+|resident\s+)?(?:called|named)\s+(.+)$/i,
  /^(?:who is|who's)\s+(.+)$/i,
 ];
 for(const pattern of patterns){
  const match=q.match(pattern);if(!match)continue;
  const cleaned=match[1].replace(/\s+(?:at|in)\s+(?:the\s+)?hostel$/i,"")
    .replace(/\s+(?:in|at)\s+room\s+\d+[a-z]?$/i,"")
    .replace(/\s+(?:available|active|registered|here)\s*$/i,"");
  const name=personName(cleaned);
  if(name)return{kind:"student-search",name,asksAvailability:/\b(?:available|here|staying|checked in)\b/i.test(q)};
 }
 return null;
}
export function isPersonSearchFollowup(question:string):boolean {
 const q=question.trim().toLowerCase();
 if(!q||q.length>200||/\broom\s*\d+/i.test(q))return false;
 return /^(?:(?:and|then|okay|so)\s+)?(?:which\s+(?:one|of them)\s+(?:is|are)\s+(?:currently\s+)?(?:available|active|registered|here|staying)|(?:is|are)\s+(?:he|she|they|that (?:person|student))\s+(?:currently\s+)?(?:available|active|registered|here|staying)|where\s+(?:is|are)\s+(?:he|she|they)\s+(?:staying|living)|(?:tell me|show me)\s+(?:more about|their room|his room|her room)|which\s+(?:one|of them)\??)/i.test(q);
}
