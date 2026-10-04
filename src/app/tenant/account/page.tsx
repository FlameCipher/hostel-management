import { requireTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { tenantLogoutAction } from "../login/actions";

const money=(v:number)=>"KES "+v.toLocaleString("en-KE",{minimumFractionDigits:2});
export default async function TenantAccountPage() {
 const session=await requireTenantSession();
 const student=await db.student.findFirst({where:{id:session.studentId,organizationId:session.organizationId,portalEnabled:true},include:{occupancies:{where:{status:{in:["RESERVED","ACTIVE"]}},include:{room:{include:{roomType:true}},semester:true},orderBy:{createdAt:"desc"},take:1},charges:{include:{semester:true,payments:{where:{reversedAt:null},select:{amount:true}}},orderBy:{createdAt:"desc"}},payments:{where:{reversedAt:null},orderBy:{paidAt:"desc"},take:20}}});
 if(!student) return <main className="marketing-section"><h1>Account unavailable</h1><form action={tenantLogoutAction}><button className="secondary-button">Sign out</button></form></main>;
 const total=student.charges.reduce((s,x)=>s+Number(x.amount),0);
 const paid=student.charges.reduce((s,x)=>s+x.payments.reduce((a,p)=>a+Number(p.amount),0),0);
 const balance=Math.max(0,total-paid), occupancy=student.occupancies[0];
 return <main className="marketing-section"><div className="page-heading-row"><div><p className="eyebrow">Student account</p><h1>{student.fullName}</h1><p>MMAMBUGUA HOSTEL tenant portal</p></div><form action={tenantLogoutAction}><button className="secondary-button">Sign out</button></form></div>
 <section className="room-summary-grid"><article className="compact-stat"><div><p>Current room</p><strong>{occupancy ? "Room "+occupancy.room.number : "Not allocated"}</strong><small>{occupancy?.room.roomType.name??"—"}</small></div></article><article className="compact-stat"><div><p>Total charges</p><strong>{money(total)}</strong></div></article><article className="compact-stat"><div><p>Payments</p><strong>{money(paid)}</strong></div></article><article className="compact-stat"><div><p>Balance</p><strong>{money(balance)}</strong></div></article></section>
 <section className="panel mt-5 overflow-hidden"><div className="panel-heading"><div><p className="panel-kicker">My statement</p><h2>Charges and balances</h2></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Description</th><th>Semester</th><th>Charge</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{student.charges.map(x=>{const p=x.payments.reduce((a,y)=>a+Number(y.amount),0);return <tr key={x.id}><td>{x.description}</td><td>{x.semester?.name??"—"}</td><td>{money(Number(x.amount))}</td><td>{money(p)}</td><td><strong>{money(Math.max(0,Number(x.amount)-p))}</strong></td></tr>})}</tbody></table></div></section>
 <section className="panel mt-5 overflow-hidden"><div className="panel-heading"><div><p className="panel-kicker">My receipts</p><h2>Recent payments</h2></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th>Amount</th></tr></thead><tbody>{student.payments.map(p=><tr key={p.id}><td>{p.receiptNumber}</td><td>{p.paidAt.toLocaleDateString("en-KE",{timeZone:"UTC"})}</td><td>{p.method.replaceAll("_"," ")}</td><td>{money(Number(p.amount))}</td></tr>)}</tbody></table></div></section></main>;
}
