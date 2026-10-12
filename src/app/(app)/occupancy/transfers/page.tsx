import Link from "next/link";
import {redirect} from "next/navigation";
import {ArrowLeft,ArrowRightLeft,ClipboardCheck,Search,ShieldCheck} from "lucide-react";
import {requireSession} from "@/lib/auth/session";
import {db} from "@/lib/db";
import {listTransferReviewRecords} from "@/lib/room-transfer-data";
import {reviewRoomTransfers} from "@/lib/room-transfer-review";
import {formatMoney} from "@/lib/currency";

export default async function TransferReviewIndex({
  searchParams,
}: {searchParams:Promise<{q?:string;view?:string}>}) {
  const session=await requireSession();
  if(session.role==="CARETAKER")redirect("/occupancy");
  const params=await searchParams;
  const search=(params.q??"").trim().slice(0,90).toLocaleLowerCase();
  const view=params.view==="flags"?"flags":"all";
  const records=await listTransferReviewRecords(db,session.organizationId,200);
  const reviewed=records.map(record=>({record,analysis:reviewRoomTransfers(record)}));
  const noteCounts=reviewed.length?await db.auditLog.groupBy({
    by:["entityId"],
    where:{
      organizationId:session.organizationId,
      action:"ROOM_TRANSFER_EVIDENCE_NOTE",entityType:"Occupancy",
      entityId:{in:reviewed.map(row=>row.record.id)},
    },
    _count:{_all:true},
  }):[];
  const noteMap=new Map(noteCounts.map(c=>[c.entityId,c._count._all]));
  const flagged=reviewed.filter(r=>r.analysis.flags.some(f=>f.level!=="info")).length;
  const ownerOverrides=reviewed.filter(r=>r.analysis.ownerOverride).length;
  const withNotes=reviewed.filter(r=>(noteMap.get(r.record.id)??0)>0).length;
  const visible=reviewed.filter(r=>{
    if(view==="flags"&&!r.analysis.flags.some(f=>f.level!=="info"))return false;
    if(!search)return true;
    return [r.record.studentName,r.record.currentRoom,r.record.semesterName,
      ...r.record.stays.map(s=>s.roomNumber)].join(" ").toLowerCase().includes(search);
  }).sort((a,b)=>b.analysis.flags.filter(f=>f.level==="critical").length-
    a.analysis.flags.filter(f=>f.level==="critical").length ||
    a.record.studentName.localeCompare(b.record.studentName));
  const currency=(record:typeof reviewed[number])=>
    record.analysis.currency??"KES";
  return <div>
    <div className="page-heading-row">
      <div><p className="eyebrow">Accommodation management · Read-only review</p>
        <h1>Room transfers &amp; financial reconciliation</h1>
        <p>Inspect transfer histories, charges, payments and owner agreements in one place. No automatic ledger or stay-date corrections.</p>
      </div>
      <Link className="secondary-button no-underline" href="/occupancy"><ArrowLeft size={17}/> Occupancies</Link>
    </div>
    <section className="room-summary-grid">
      <article className="compact-stat"><div><p>Transfer cases</p><strong>{reviewed.length}</strong></div></article>
      <article className="compact-stat"><div><p>Review flags</p><strong>{flagged}</strong></div></article>
      <article className="compact-stat"><div><p>Agreed adjustments</p><strong>{ownerOverrides}</strong></div></article>
      <article className="compact-stat"><div><p>Cases with notes</p><strong>{withNotes}</strong></div></article>
    </section>
    <div className="policy-banner mt-5"><ShieldCheck size={22}/>
      <div><strong>Recorded dates and physical presence are different kinds of evidence.</strong>
        <p>A room-stay timestamp shows what management recorded, not necessarily how many nights the student physically stayed. Owner-approved semester overrides remain authoritative unless separately revised. Alternative rent calculations are previews, not invoices.</p>
      </div>
    </div>
    <section className="panel mt-5 overflow-hidden" aria-label="Transfer case overview">
      <div className="panel-heading">
        <div><p className="panel-kicker">Transfer case register</p>
          <h2>{view==="flags"?"Transfers needing review":"All recorded room transfers"}</h2>
          <p className="muted-note">Includes current and historic accommodation segments with live un-reversed payments.</p>
        </div>
        <Link className="secondary-button no-underline"
          href={view==="all"?"/occupancy/transfers?view=flags":"/occupancy/transfers"}>
          {view==="all"?"Needs review":"Show all transfers"}
        </Link>
      </div>
      <form method="get" className="filter-bar student-filter-bar">
        {view==="flags"?<input type="hidden" name="view" value="flags"/>:null}
        <label className="filter-search"><Search size={17}/>
          <input name="q" aria-label="Find a room-transfer case"
            maxLength={90} defaultValue={params.q??""} placeholder="Student or previous/current room"/>
        </label>
        <button className="secondary-button" type="submit">Find transfer</button>
      </form>
      {records.length>=200?<p className="muted-note">
        Showing the most recently updated 200 transfer candidates; older histories may require a narrower review.
      </p>:null}
      {visible.length?<div className="table-scroll"><table className="data-table">
        <thead><tr><th>Student</th><th>Recorded room sequence</th><th>Rent position</th>
          <th>Findings and notes</th><th>Review</th></tr></thead>
        <tbody>{visible.map(({record,analysis})=><tr key={record.id}>
          <td><strong>{record.studentName}</strong>
            <small className="table-subtext">{record.semesterName} · {record.status}</small></td>
          <td>{analysis.stays.map(s=>"Room "+s.roomNumber).join(" → ")}
            <small className="table-subtext">{analysis.transferCount} recorded transfer{analysis.transferCount===1?"":"s"}</small></td>
          <td><strong>{analysis.recordedRent!==null?
              formatMoney(analysis.recordedRent,currency({record,analysis})):"Missing rent charge"}</strong>
            <small className="table-subtext">{formatMoney(analysis.paid,currency({record,analysis}))} paid
              · {formatMoney(analysis.balance,currency({record,analysis}))} remaining</small></td>
          <td>
            {analysis.flags.length?analysis.flags.map(f=>
              <div key={f.code}><small className="table-subtext">{f.level==="critical"?"Critical":"Review"}: {f.code.replaceAll("_"," ").toLowerCase()}</small></div>
            ):<span className="status-pill status-full">No automated flags</span>}
            {noteMap.get(record.id)?<small className="table-subtext">
              <ClipboardCheck size={13}/> {noteMap.get(record.id)} audit note{noteMap.get(record.id)===1?"":"s"}
            </small>:null}
          </td>
          <td><Link href={"/occupancy/"+encodeURIComponent(record.id)+"/transfer-review"}
            className="table-action"><ArrowRightLeft size={15}/> Inspect case</Link></td>
        </tr>)}</tbody>
      </table></div>:<div className="inline-empty">
        <ClipboardCheck size={25}/><strong>No matching transfers</strong>
        <p>Clear filters or inspect an individual occupancy record.</p>
      </div>}
    </section>
    <p className="muted-note mt-5">
      Manual review does not establish a payment error or authorize a refund.
      For ordinary occupancy and payment audit, use <Link href="/payments/audit">Financial integrity</Link>.
    </p>
  </div>;
}
