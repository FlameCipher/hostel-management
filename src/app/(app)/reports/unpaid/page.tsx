import Link from "next/link";
import { requireStaffFinanceAccess } from "@/lib/staff-route-authorization";
import { residentStaff } from "@/lib/resident-access";
import { db } from "@/lib/db";
import { readUnpaidReport } from "@/lib/unpaid-report";
import { whatsappNumber } from "@/lib/whatsapp-policy";
import { UnpaidReportShare } from "@/components/unpaid-report-share";
import styles from "@/components/arrears-form.module.css";
export const dynamic="force-dynamic";
export default async function UnpaidReportPage(){
 const session=await requireStaffFinanceAccess();
 if(!await residentStaff(db,session,true))return <p>Active management access is required.</p>;
 const [report,staff]=await Promise.all([readUnpaidReport(db,session.organizationId),db.user.findMany({where:{organizationId:session.organizationId,active:true},select:{id:true,name:true,role:true,phone:true},orderBy:{name:"asc"}})]);
 const contacts=staff.flatMap(person=>{const phone=whatsappNumber(person.phone,"KE");return phone?[{id:person.id,name:person.name,role:person.role,phone}]:[];});
 return <div className={styles.page}><h1>Unpaid balances · Staff PDF</h1><p>{report.rows.length} current students with unpaid rent. Includes future balances and approved arrangements, clearly marked. Students who have cleared their balances are excluded.</p><p><Link href="/reports/arrears">Prepare overdue payment demands</Link> · <Link href="/services">Service links</Link></p><UnpaidReportShare key={report.fingerprint} contacts={contacts} fingerprint={report.fingerprint}/>{report.reviewCount>0&&<p role="alert">{report.reviewCount} accounts were excluded because their ledger needs review. <Link href="/payments/audit">Review accounts</Link></p>}<h2>Review the report</h2><div className={styles.list}>{report.rows.map(row=><article className={styles.tenant} key={row.studentId}><div className={styles.tenantHeader}><span><strong>{row.name}</strong><small>Room {row.room} · {row.status}</small></span><strong>{row.balance}</strong></div><p>Overdue: {row.overdue}{!row.demandEligible?" · No payment demand due now":""}</p></article>)}</div>{!report.rows.length&&<p>No unpaid balances found.</p>}</div>;
}
