export type KnowledgeTopic="overview"|"contact"|"location"|"pricing"|"vacancy"|"semester"|"policy"|"facilities"|"booking"|"coverage"|"history";
/** Recognize only topics with a trusted corresponding data source. */
export function hostelKnowledgeTopic(question:string):KnowledgeTopic|null {
 const q=question.trim().toLocaleLowerCase("en");
 if(!q||q.length>1200||/\broom\s*(?:number\s*)?\d+/i.test(q))return null;
 // A person-specific rent or statement is private, never a public price list.
 if(/(?:\b(?:my|his|her|their)\b|[\p{L}][\p{L}.'-]*[’\']s)\s+(?:rent|balance|payments?|receipts?|charges?)\b/u.test(q))return null;
 if(/\b(?:what.*(?:know|everything)|tell me everything|overview|tell me about|about (?:the |our )?hostel|explain the hostel|hostel information|who are you)\b/i.test(q))return"overview";
 if(/\b(?:what.*missing|knowledge gaps?|incomplete records?|what.*not know|data readiness|training coverage)\b/i.test(q))return"coverage";
 if(/\b(?:founded|established|history|how old is the hostel|when.*started)\b/i.test(q))return"history";
 if(/\b(?:rules?|terms|polic(?:y|ies)|curfew|gate hours?|opening hours?|closing time|visitors?|guests?|entry|exit|holidays?|returning|check.?out|notice period|deposit|arrears|deadline|quiet hours?|night|evening)\b/i.test(q))return"policy";
 if(/\b(?:facilities|amenities|wi.?fi|internet|cctv|water|electricity|borehole|security|compound|utilities)\b/i.test(q))return"facilities";
 if(/\b(?:price|prices|cost|fees?|tariffs?|rates?|rent per month|rent per semester|room types?|bedsitter|sharing rates?)\b/i.test(q) || /\bhow much\b.*\b(?:single|shared|room|bed|rent|accommodation)\b/i.test(q))return"pricing";
 if(/\b(?:availability|available|vacan(?:t|cy|cies)|empty rooms?|spaces?|beds? free|free room|capacity)\b/i.test(q))return"vacancy";
 if(/\b(?:semester|academic term|term dates|school calendar|academic calendar|term starts?)\b/i.test(q))return"semester";
 if(/\b(?:where (?:are|is)|address|located|directions?|location|near (?:jkuat|gate)|distance to gate|map)\b/i.test(q))return"location";
 if(/\b(?:owner|owns?|owned by|contact|telephone|phone number|call|email address|management number|who manages)\b/i.test(q))return"contact";
 if(/\b(?:booking|book|reserve|apply for room|how to join|how to move in)\b/i.test(q))return"booking";
 return null;
}
/** Returns a stable policy category; never synthesizes an unapproved house rule. */
export function officialPolicyTopics(question:string):string[] {
 const q=question.toLowerCase();
 const rules=[
  {keywords:/\b(?:visitor|guest|overnight|occupant)\b/,title:"Visitors and occupants"},
  {keywords:/\b(?:rent|due|arrears|pay|payment|balance|deadline)\b/,title:"Semester rent and arrears"},
  {keywords:/\b(?:curfew|entrance|entry|exit|hours|night|evening|gate|opening|closing)\b/,title:"Entry and exit hours"},
  {keywords:/\b(?:holiday|return|retention|vacation)\b/,title:"Long holidays and returning"},
  {keywords:/\b(?:wifi|wi-fi|internet|cctv|camera)\b/,title:"CCTV and Wi-Fi"},
  {keywords:/\b(?:water|borehole|drink|boil)\b/,title:"Borehole water"},
  {keywords:/\b(?:damage|cleanliness|noise|rubbish|quiet)\b/,title:"Cleanliness, respect and damage"},
  {keywords:/\b(?:key|belonging|valuables|theft|safety|security)\b/,title:"Personal belongings and safety"},
  {keywords:/\b(?:move out|moving out|checkout|check-out|clearance|deposit|notice)\b/,title:"Moving out and clearance"},
 ];
 return rules.filter(r=>r.keywords.test(q)).map(r=>r.title);
}
