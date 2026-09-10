import { notFound } from "next/navigation";
import { PrintReceiptButton } from "@/components/print-receipt-button";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getReport, reportNames, type ReportType } from "@/lib/reports";
export default async function PrintReportPage({searchParams}:{searchParams:Promise<{type?:string}>}) { const session=await requireSession(); const {type:raw}=await searchParams; if(!raw || !(raw in reportNames)) notFound(); const type=raw as ReportType; const [report,org]=await Promise.all([getReport(type,session.organizationId),db.organization.findUnique({where:{id:session.organizationId}})]); return <div className="print-report"><div className="receipt-toolbar print-hidden"><PrintReceiptButton label="Print / Save PDF" /></div><header><h1>{org?.name}</h1><h2>{reportNames[type]}</h2><p>Generated {new Date().toLocaleDateString("en-KE")}</p></header><div className="table-scroll"><table className="data-table"><thead><tr>{report.columns.map((c)=><th key={c}>{c}</th>)}</tr></thead><tbody>{report.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div></div>; }
