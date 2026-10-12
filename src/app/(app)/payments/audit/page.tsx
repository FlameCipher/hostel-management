import { formatMoney } from "@/lib/currency";
import { possibleTransferRentTreatments } from "@/lib/financial-audit-rent-preview";
import {
  auditActiveOccupancy, financialAuditSummary,
  type FinancialAuditOccupancy,
} from "@/lib/financial-integrity-audit";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRightLeft, ClipboardCheck, ShieldCheck } from "lucide-react";

export default async function FinancialIntegrityPage({
  searchParams,
}: {searchParams: Promise<{view?: string; q?: string}>}) {
  const session=await requireSession();
  if(!["OWNER","ADMIN"].includes(session.role)) redirect("/payments");
  const params=await searchParams;
  const showAll=params.view==="all";
  const search=(params.q??"").trim().slice(0,90).toLocaleLowerCase();

  const occupancies=await db.occupancy.findMany({
    where:{organizationId:session.organizationId,status:"ACTIVE"},
    include:{
      student:{select:{fullName:true,admissionNumber:true}},
      room:{include:{roomType:true}},
      semester:{select:{name:true,startDate:true,endDate:true}},
      roomStays:{
        orderBy:{startDate:"asc"},
        include:{room:{select:{number:true}}},
      },
      charges:{
        where:{type:"SEMESTER_RENT"},
        include:{
          payments:{
            where:{reversedAt:null},
            select:{amount:true,currency:true,studentId:true,organizationId:true},
          },
          adjustments:{select:{reason:true,calculationMethod:true}},
        },
      },
    },
    orderBy:{student:{fullName:"asc"}},
  });

  const rows=occupancies.map((o)=>{
    const input:FinancialAuditOccupancy={
      id:o.id,organizationId:o.organizationId,studentId:o.studentId,
      studentName:o.student.fullName,roomId:o.roomId,
      roomNumber:o.room.number,roomTypeId:o.room.roomTypeId,
      roomTypeName:o.room.roomType.name,
      monthlyRate:Number(o.room.roomType.monthlyRate),
      semesterRate:Number(o.room.roomType.semesterRate),
      stays:o.roomStays.map((s)=>({
        roomId:s.roomId,roomNumber:s.room.number,
        startDate:s.startDate,endDate:s.endDate,
        monthlyRate:Number(s.monthlyRateSnapshot),
        semesterRate:Number(s.semesterRateSnapshot),
      })),
      charges:o.charges.map((c)=>({
        id:c.id,amount:Number(c.amount),currency:c.currency,status:c.status,
        description:c.description,roomTypeId:c.roomTypeId,
        payments:c.payments.map((p)=>({
          amount:Number(p.amount),currency:p.currency,
          organizationId:p.organizationId,studentId:p.studentId,
        })),
        adjustments:c.adjustments.map((a)=>({
          reason:a.reason,calculationMethod:a.calculationMethod,
        })),
      })),
    };
    return {
      ...input,
      admissionNumber:o.student.admissionNumber,
      semester:o.semester.name,
      findings:auditActiveOccupancy(input),
      preview:possibleTransferRentTreatments(input,o.semester.startDate,o.semester.endDate),
      hasOwnerAdjustments:input.charges.some((c)=>c.adjustments.some((a)=>a.reason==="RATE_CORRECTION" || a.calculationMethod==="CUSTOM")),
    };
  });
  const summary=financialAuditSummary(rows);
  const visibleRows=rows.filter((r)=>
    (showAll||r.findings.length>0) &&
    (!search || [
      r.studentName,r.admissionNumber??"",r.roomNumber,
      ...r.stays.map((stay)=>stay.roomNumber),
    ].join(" ").toLocaleLowerCase().includes(search))
  ).sort((a,b)=>{
    const score=(row:typeof a)=>row.findings.some((f)=>f.severity==="critical")?3:
      row.findings.some((f)=>f.severity==="review")?2:row.findings.length?1:0;
    return score(b)-score(a) || a.studentName.localeCompare(b.studentName);
  });
  const money=(amount:number,currency:string)=>formatMoney(amount,currency);
  return <div>
    <div className="page-heading-row">
      <div>
        <p className="eyebrow">Owner &amp; Admin · Read-only</p>
        <h1>Financial integrity review</h1>
        <p>Audit active room allocations, semester rent charges, transfer history and credited payments without changing any records.</p>
      </div>
      <div className="heading-actions"><Link className="secondary-button no-underline" href="/occupancy/transfers"><ArrowRightLeft size={17}/> Transfer cases</Link><Link className="secondary-button no-underline" href="/payments"><ArrowLeft size={17}/> Payments</Link></div>
    </div>
    <section className="room-summary-grid payments-summary">
      <article className="compact-stat"><div><p>Active occupancies checked</p><strong>{summary.occupancies}</strong></div></article>
      <article className="compact-stat"><div><p>Residents needing review</p><strong>{summary.needingReview}</strong></div></article>
      <article className="compact-stat"><div><p>Critical findings</p><strong>{summary.critical}</strong></div></article>
      <article className="compact-stat"><div><p>Review / information flags</p><strong>{summary.review+summary.informational}</strong></div></article>
    </section>
    <div className="policy-banner mt-5">
      <ShieldCheck size={22}/>
      <div>
        <strong>Audit only — no automatic rent repairs</strong>
        <p>A room-type or rate difference can reflect an agreed contract or owner override. This screen does not recalculate or change charges, dates, payment allocations or receipts. Verify the accommodation agreement before approving a financial adjustment.</p>
      </div>
    </div>
    <section className="panel mt-5 overflow-hidden" aria-label="Room financial audit findings">
      <div className="panel-heading">
        <div><p className="panel-kicker">Active-occupancy review</p><h2>{showAll?"All active occupancies":"Flagged occupancy records"}</h2>
          <p className="muted-note">Includes missing/duplicate rent, old room references, unmatched current room types, transfer rate changes without adjustments, payment linkage, overpayments and broken room history.</p>
        </div>
        <Link className="secondary-button no-underline" href={showAll?"/payments/audit":"/payments/audit?view=all"}>{showAll?"Show flagged only":"Show all residents"}</Link>
      </div>
      <form method="get" className="filter-bar student-filter-bar">
        {showAll?<input type="hidden" name="view" value="all"/>:null}
        <label className="filter-search"><ClipboardCheck size={17}/>
          <input name="q" defaultValue={params.q??""} maxLength={90}
            aria-label="Search audit by student or room" placeholder="Student, admission or room number"/>
        </label>
        <button className="secondary-button" type="submit">Find record</button>
      </form>
      {visibleRows.length?<div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Resident</th><th>Current room &amp; tariff</th><th>Recorded rent / paid</th><th>Audit findings</th><th>Review</th></tr></thead>
          <tbody>{visibleRows.map((row)=>{
            const c=row.charges[0];
            const paid=row.charges.reduce((sum,charge)=>sum+charge.payments.reduce((v,p)=>v+p.amount,0),0);
            const currency=c?.currency??"KES";
            return <tr key={row.id}>
              <td><strong>{row.studentName}</strong><small className="table-subtext">{row.semester}{row.admissionNumber?" · "+row.admissionNumber:""}</small></td>
              <td>Room {row.roomNumber}<small className="table-subtext">{row.roomTypeName}</small>
                <small className="table-subtext">{money(row.semesterRate,currency)} configured semester rate</small>
              </td>
              <td>{c?<><strong>{money(row.charges.reduce((sum,item)=>sum+item.amount,0),currency)}</strong>
                  <small className="table-subtext">{money(paid,currency)} paid</small>
                  {row.hasOwnerAdjustments?<small className="table-subtext">Prior adjustment / override recorded</small>:null}
                </>:<strong>No linked rent charge</strong>}
              </td>
              <td>{row.findings.length?row.findings.map((finding,i)=>
                <div key={finding.code+"-"+i} className="mb-2">
                  <span className={"status-pill "+(finding.severity==="critical"?"status-maintenance":finding.severity==="review"?"status-partial":"status-full")}>
                    {finding.severity==="information"?"Check label":finding.severity==="critical"?"Critical":"Review"}
                  </span>
                  <strong className="table-subtext">{finding.title}</strong>
                  <small className="table-subtext">{finding.detail}</small>
                </div>
              ):<span className="status-pill status-full">No flags</span>}
                {row.preview ? <div className="mt-3">
                  <strong className="table-subtext">Possible agreements for owner review only</strong>
                  <small className="table-subtext">Month-of-transfer pricing: {money(row.preview.monthly.total,row.preview.currency)} rent · {money(row.preview.monthly.balance,row.preview.currency)} remaining.</small>
                  <small className="table-subtext">Full destination-room semester rate: {money(row.preview.destinationSemester.total,row.preview.currency)} rent · {money(row.preview.destinationSemester.balance,row.preview.currency)} remaining.</small>
                  <small className="table-subtext">These are illustrations, not corrections or instructions to charge the student.</small>
                </div> : null}
              </td>
              <td><Link className="table-action" href={"/occupancy/"+encodeURIComponent(row.id)}>View occupancy</Link></td>
            </tr>;
          })}</tbody>
        </table>
      </div>:<div className="inline-empty">
        <ShieldCheck size={27}/><strong>{search?"No matching records":showAll?"No active occupancies":"No audit flags found"}</strong>
        <p>{search?"Clear the search or inspect another room.":"The rules found no problems within the scope of this read-only check."}</p>
      </div>}
    </section>
    <div className="policy-banner mt-5">
      <AlertTriangle size={22}/>
      <div>
        <strong>What the audit does not establish</strong>
        <p>Room history captures recorded system dates, not independently verified physical move dates. Historical full-semester discounts, owner-approved overrides and payment provider statements require supporting evidence. A mismatched tariff alone does not authorize a correction.</p>
      </div>
    </div>
  </div>;
}
