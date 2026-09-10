import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getReport, reportNames, type ReportType } from "@/lib/reports";
const valid = new Set(Object.keys(reportNames));
const escape = (value: string) => `"${value.replaceAll('"','""')}"`;
export async function GET(request: NextRequest) { const session = await requireSession(); const raw=request.nextUrl.searchParams.get("type") ?? ""; if(!valid.has(raw)) return new Response("Invalid report",{status:400}); const type=raw as ReportType; const report=await getReport(type,session.organizationId); const csv=[report.columns,...report.rows].map((row)=>row.map((cell)=>escape(String(cell))).join(",")).join("\r\n"); return new Response("\uFEFF"+csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${type}-report.csv"`}}); }
