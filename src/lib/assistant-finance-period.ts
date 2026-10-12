/**
 * Exact Nairobi-local accounting windows for assistant finance questions.
 * Query windows are [start,end), and never silently become all-time.
 * Kenya uses UTC+03:00; the IANA zone determines the local calendar date.
 */
export type FinancePeriod =
  | { kind: "all"; label: string }
  | { kind: "calendar"; label: string; start: Date; end: Date }
  | { kind: "semester"; which: "current" | "previous" }
  | { kind: "ambiguous"; label: string };

const NAIROBI_OFFSET_MS=3*60*60*1000;
function localParts(now:Date) {
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const value=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
  return {year:value("year"),month:value("month"),day:value("day")};
}
function localDay(year:number,month:number,day:number) {
  return new Date(Date.UTC(year,month-1,day)-NAIROBI_OFFSET_MS);
}
function calendarMonth(year:number,month:number,label?:string):FinancePeriod {
  return {kind:"calendar",label:label??new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1))),
    start:localDay(year,month,1),end:localDay(year,month+1,1)};
}
export function nairobiDayBounds(date:Date) {
  const {year,month,day}=localParts(date);
  return {start:localDay(year,month,day),end:localDay(year,month,day+1)};
}
export function requestedFinancePeriod(question:string,explicitMonth:string|null,now=new Date()):FinancePeriod {
  const q=question.toLocaleLowerCase("en");
  const local=localParts(now);
  const currentSemester=/\b(?:this|current|active)\s+semester\b/.test(q);
  const previousSemester=/\b(?:last|previous|prior)\s+semester\b/.test(q);
  const namedMonth=explicitMonth&&/^\d{4}-(?:0[1-9]|1[0-2])$/.test(explicitMonth);
  const relativeMonth=/\b(?:this|current|last|previous)\s+month\b/.test(q);
  const dayScope=/\b(?:today|yesterday)\b/.test(q);
  const weekScope=/\b(?:this|last|previous)\s+week\b/.test(q);
  const yearScope=/\b(?:this|current|last|previous)\s+year\b/.test(q);
  const explicitYear=q.match(/\b(?:in|for|during|year)\s+(20\d{2})\b/)?.[1];
  const choices=[currentSemester||previousSemester,relativeMonth||namedMonth,dayScope,weekScope,yearScope||Boolean(explicitYear)].filter(Boolean).length;
  const conflictingRelative = (/(?:this|current)\s+month/.test(q)&&/(?:last|previous)\s+month/.test(q)) ||
    (/(?:this|current)\s+week/.test(q)&&/(?:last|previous)\s+week/.test(q)) ||
    (/(?:this|current)\s+year/.test(q)&&/(?:last|previous)\s+year/.test(q)) ||
    (/\btoday\b/.test(q)&&/\byesterday\b/.test(q));
  if(choices>1||(currentSemester&&previousSemester)||conflictingRelative)return {kind:"ambiguous",label:"Multiple different accounting periods were requested. Specify one period."};
  if(currentSemester)return {kind:"semester",which:"current"};
  if(previousSemester)return {kind:"semester",which:"previous"};
  if(namedMonth) {
    const [year,month]=explicitMonth!.split("-").map(Number);
    return calendarMonth(year,month);
  }
  if(relativeMonth) {
    const delta=/\b(?:last|previous)\s+month\b/.test(q)?-1:0;
    return calendarMonth(local.year,local.month+delta);
  }
  if(dayScope) {
    const target=/\byesterday\b/.test(q)?new Date(now.getTime()-86400000):now;
    const bounds=nairobiDayBounds(target);
    const label=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Nairobi",dateStyle:"medium"}).format(target);
    return {kind:"calendar",label,start:bounds.start,end:bounds.end};
  }
  if(weekScope) {
    const currentDay=localDay(local.year,local.month,local.day);
    const localWeekday=new Date(Date.UTC(local.year,local.month-1,local.day)).getUTCDay();
    const offset=(localWeekday+6)%7;
    const prev=/\b(?:last|previous)\s+week\b/.test(q)?7:0;
    const start=new Date(currentDay.getTime()-(offset+prev)*86400000);
    const end=new Date(start.getTime()+7*86400000);
    return {kind:"calendar",start,end,label:prev?"Last Nairobi calendar week":"This Nairobi calendar week"};
  }
  if(yearScope||explicitYear) {
    const year=explicitYear?Number(explicitYear):local.year-(/\b(?:last|previous)\s+year\b/.test(q)?1:0);
    return {kind:"calendar",label:String(year),start:localDay(year,1,1),end:localDay(year+1,1,1)};
  }
  return {kind:"all",label:"All recorded periods"};
}
