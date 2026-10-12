import Link from "next/link";
import {randomUUID} from "node:crypto";
import {notFound,redirect} from "next/navigation";
import {
  AlertTriangle,ArrowLeft,ArrowRightLeft,ClipboardCheck,ReceiptText,ShieldCheck,
} from "lucide-react";
import {requireSession} from "@/lib/auth/session";
import {db} from "@/lib/db";
import {loadTransferReviewRecord} from "@/lib/room-transfer-data";
import {reviewRoomTransfers} from "@/lib/room-transfer-review";
import {formatMoney} from "@/lib/currency";
import {TransferEvidenceForm} from "@/components/transfer-evidence-form";

const date=(value:Date)=>value.toLocaleDateString("en-KE",{timeZone:"UTC",day:"2-digit",month:"short",year:"numeric"});

function detailMeta(value:unknown):Record<string,unknown>{
  return value!==null&&typeof value==="object"&&!Array.isArray(value)?
    value as Record<string,unknown>:{};
}
function safeDetail(value:unknown){
  return typeof value==="string"&&value.trim()?value:"Not provided";
}

export default async function TransferCaseDetail({
  params,
}: {params:Promise<{id:string}>}){
  const session=await requireSession();
  if(session.role==="CARETAKER")redirect("/occupancy");
  const {id}=await params;
  const record=await loadTransferReviewRecord(db,session.organizationId,id);
  if(!record||record.stays.length<2)notFound();
  const result=reviewRoomTransfers(record);
  const canNote=["OWNER","ADMIN"].includes(session.role);
  const notes=await db.auditLog.findMany({
    where:{
      organizationId:session.organizationId,
      entityType:"Occupancy",entityId:record.id,
      action:"ROOM_TRANSFER_EVIDENCE_NOTE",
    },
    include:{actor:{select:{name:true}}},
    orderBy:{createdAt:"desc"},
    take:40,
  });
  const money=(value:number)=>formatMoney(value,result.currency??"KES");
  return <div>
    <div className="page-heading-row">
      <div><p className="eyebrow">Room Transfers · Historical review</p>
        <h1>{record.studentName}</h1>
        <p>Recorded route {result.stays.map(s=>"Room "+s.roomNumber).join(" → ")} · {record.semesterName}</p>
      </div>
      <div className="heading-actions">
        <Link href="/occupancy/transfers" className="secondary-button no-underline">
          <ArrowLeft size={17}/> Transfers</Link>
        <Link href={"/occupancy/"+encodeURIComponent(record.id)} className="secondary-button no-underline">
          <ArrowRightLeft size={17}/> Occupancy record</Link>
      </div>
    </div>
    <section className="room-summary-grid payments-summary">
      <article className="compact-stat"><div><p>Recorded transfers</p><strong>{result.transferCount}</strong></div></article>
      <article className="compact-stat"><div><p>Agreed semester rent</p><strong>{result.recordedRent===null?"None":money(result.recordedRent)}</strong></div></article>
      <article className="compact-stat"><div><p>Active payments</p><strong>{money(result.paid)}</strong></div></article>
      <article className="compact-stat"><div><p>Outstanding</p><strong>{money(result.balance)}</strong></div></article>
    </section>
    <section className="panel mt-5 overflow-hidden">
      <div className="panel-heading"><div>
        <p className="panel-kicker">Recorded occupancy history</p>
        <h2>Room stays and stored rates</h2>
        <p className="muted-note">The system preserves entry and transfer dates. This does not independently confirm physical nights spent in a room.</p>
      </div></div>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Room</th><th>Accommodation</th><th>System start</th><th>System end</th>
          <th>Monthly rate snapshot</th><th>Semester rate snapshot</th></tr></thead>
        <tbody>{result.stays.map(s=><tr key={s.id}>
          <td><strong>Room {s.roomNumber}</strong></td><td>{s.roomTypeName}</td>
          <td>{date(s.startDate)}</td><td>{s.endDate?date(s.endDate):"Current active stay"}</td>
          <td>{money(s.monthlyRate)}</td><td>{money(s.semesterRate)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
    <section className="panel mt-5">
      <div className="panel-heading"><div><p className="panel-kicker">Contract and ledger</p>
        <h2>Recorded charges and payment allocations</h2></div><ReceiptText size={20}/></div>
      {record.charges.length?record.charges.map(c=><div key={c.id}>
        <dl className="detail-list">
          <div><dt>Rent description</dt><dd>{c.description}</dd></div>
          <div><dt>Agreed charged amount</dt><dd><strong>{formatMoney(c.amount,c.currency)}</strong></dd></div>
          <div><dt>Original charge basis</dt><dd>{c.baseAmount===null?"Not separately recorded":formatMoney(c.baseAmount,c.currency)}</dd></div>
          <div><dt>Current status</dt><dd>{c.status.replaceAll("_"," ")}</dd></div>
          <div><dt>Owner or rent adjustments</dt><dd>{c.adjustments.length}</dd></div>
        </dl>
        {c.adjustments.length?<p className="muted-note">
          Recorded adjustment methods: {c.adjustments.map(a=>a.calculationMethod.replaceAll("_"," ")).join(", ")}.
          Existing adjustments are preserved as contract history.
        </p>:null}
      </div>):<p role="alert">No semester rent charge is linked to this occupancy.</p>}
      {result.ownerOverride?<div className="policy-banner mt-4"><ShieldCheck size={20}/>
        <div><strong>Existing agreed adjustment protected</strong>
          <p>An owner-approved or specially adjusted semester charge exists. Do not replace it with an automatically calculated alternative.</p>
        </div></div>:null}
    </section>
    {result.monthly&&result.destination?<section className="panel mt-5 overflow-hidden">
      <div className="panel-heading"><div>
        <p className="panel-kicker">Non-binding alternatives</p>
        <h2>Compare possible billing treatments</h2>
        <p className="muted-note">These are illustrations only. They do not change rent, issue credit, imply a refund, or establish the student's agreed contract.</p>
      </div></div>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Scenario</th><th>Semester rent</th><th>Balance after current payments</th></tr></thead>
        <tbody>
          <tr><td><strong>Recorded agreement (authoritative)</strong></td>
            <td>{result.recordedRent!==null?money(result.recordedRent):"Unknown"}</td>
            <td>{money(result.balance)}</td></tr>
          <tr><td>Illustrative calendar-month transfer pricing</td>
            <td>{money(result.monthly.total)}</td><td>{money(result.monthly.balance)}</td></tr>
          <tr><td>Illustrative full destination-room semester price</td>
            <td>{money(result.destination.rent)}</td><td>{money(result.destination.balance)}</td></tr>
        </tbody></table></div>
      <div className="table-scroll mt-3"><table className="data-table">
        <thead><tr><th>Calendar month</th><th>Saved room for billing preview</th><th>Illustrative rent</th></tr></thead>
        <tbody>{result.monthly.lines.map(line=><tr key={line.month}>
          <td>{line.month}</td>
          <td>{result.stays.find(s=>s.roomId===line.roomId)?.roomNumber??"Historical"} </td>
          <td>{money(line.rate)}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="muted-note mt-3">
        Partial calendar months, backdated physical presence and owner-specific agreements require manual examination.
        This page cannot authorize an adjustment; approved financial corrections use the existing guarded owner workflow.
      </p>
    </section>:null}
    {result.flags.length?<section className="panel mt-5">
      <div className="panel-heading"><div><p className="panel-kicker">Integrity findings</p>
        <h2>Items for management review</h2></div><AlertTriangle size={20}/></div>
      {result.flags.map(f=><p key={f.code}>
        <strong>{f.level==="critical"?"Critical":f.level==="review"?"Review":"Information"}: {f.code.replaceAll("_"," ")}</strong>
        {" — "+f.detail}
      </p>)}
    </section>:null}
    <section className="panel mt-5">
      <div className="panel-heading"><div>
        <p className="panel-kicker">Provenance and evidence</p><h2>Audit observations</h2>
        <p className="muted-note">Staff reports, student statements or document labels are recorded as claims until checked against an independent source.</p>
      </div><ClipboardCheck size={20}/></div>
      {notes.length?notes.map(note=>{
        const metadata=detailMeta(note.metadata);
        return <div className="mt-4" key={note.id}>
          <p><strong>{safeDetail(metadata.noteType).replaceAll("_"," ")}</strong>
            {" · "+date(note.createdAt)}{" · "+(note.actor?.name??"Management")}</p>
          <p>{safeDetail(metadata.note)}</p>
          {metadata.reportedPhysicalMoveDate?<p className="muted-note">
            Claimed physical move date (not verified): {safeDetail(metadata.reportedPhysicalMoveDate)}
          </p>:null}
          {metadata.evidenceReference?<p className="muted-note">
            Source reference supplied (not uploaded/verified): {safeDetail(metadata.evidenceReference)}
          </p>:null}
        </div>;
      }):<p className="muted-note">No supporting observations recorded in this module yet.</p>}
    </section>
    {canNote?<div className="mt-5"><TransferEvidenceForm
      occupancyId={record.id} fingerprint={result.fingerprint}
      requestId={randomUUID()}/></div>:null}
  </div>;
}
