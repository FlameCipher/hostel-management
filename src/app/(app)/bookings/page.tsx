import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { updateBookingAction } from "./actions";
import styles from "./bookings.module.css";
export const metadata={title:"Booking requests",robots:{index:false,follow:false}};
export default async function BookingsPage({searchParams}:{searchParams:Promise<{status?:string;page?:string;error?:string}>}){
 const s=await requireSession();if(!["OWNER","ADMIN","MANAGER"].includes(s.role))return<section className="panel entity-form"><h1>Booking requests</h1><p>An owner, admin or manager account is required.</p></section>;
 const search=await searchParams;const status=["REQUESTED","CONTACTED","CLOSED"].includes(search.status??"")?search.status!:"REQUESTED";
 const page=Math.max(1,Math.min(10000,Number.parseInt(search.page??"1",10)||1));const where={organizationId:s.organizationId,status};
 const [total,requests]=await Promise.all([db.bookingRequest.count({where}),db.bookingRequest.findMany({where,include:{property:{select:{name:true}},roomType:{select:{name:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}],take:30,skip:(page-1)*30})]);
 return <div className={styles.page}>
  <div className="page-heading-row"><div>
   <p className="eyebrow">Website requests</p><h1>Bookings</h1>
   <p>{total} {status === "REQUESTED" ? "new" : status.toLowerCase()} {total === 1 ? "request" : "requests"}. These requests do not reserve rooms or record payments.</p>
  </div></div>
  <section className={`panel ${styles.filters}`} aria-label="Filter booking requests">
   <form className={styles.filterForm} method="get">
    <label className="field-group"><span>Status</span><select name="status" defaultValue={status}><option value="REQUESTED">New requests</option><option value="CONTACTED">Contacted</option><option value="CLOSED">Closed</option></select></label>
    <button className="secondary-button" type="submit">Show requests</button>
   </form>
   {search.error && <p className={`form-error ${styles.error}`} role="alert">The update could not be confirmed. Refresh and try again.</p>}
   <p className={styles.guidance}>Contact the student to confirm availability and payment instructions. Use Students, Check-in / Check-out and Payments to complete their registration, allocation and verified payment.</p>
  </section>
  <section className={`panel ${styles.results}`} aria-label="Booking requests">
   {requests.length ? <>
    <p className={styles.scrollHint}>Swipe the table sideways to see all details.</p>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Booking request details">
     <table className={`data-table ${styles.table}`}>
      <thead><tr><th scope="col">Reference / hostel</th><th scope="col">Student</th><th scope="col">Room / move-in</th><th scope="col">Received</th><th scope="col">Status</th></tr></thead>
      <tbody>{requests.map(r => <tr key={r.id}>
       <td>{r.reference}<br/>{r.property.name}</td>
       <td>{r.fullName}<br/><a href={`tel:${r.phone}`}>{r.phone}</a>{r.email && <><br/><a href={`mailto:${r.email}`}>{r.email}</a></>}</td>
       <td>{r.roomType.name}<br/>{r.preferredMoveIn.toISOString().slice(0,10)}</td>
       <td>{new Intl.DateTimeFormat("en-KE",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Nairobi"}).format(r.createdAt)} EAT</td>
       <td><form action={updateBookingAction} className={styles.statusForm}>
        <input name="id" type="hidden" value={r.id}/>
        <label className="field-group"><span className="sr-only">Status for {r.reference}</span><select name="status" defaultValue={r.status}><option value="REQUESTED">New request</option><option value="CONTACTED">Contacted</option><option value="CLOSED">Closed</option></select></label>
        <button className="secondary-button" type="submit">Save</button>
       </form></td>
      </tr>)}</tbody>
     </table>
    </div>
   </> : <div className={styles.empty}>
    <h2>No requests in this status</h2>
    <p>Requests submitted through your website will appear here. Choose another status to view contacted or closed requests.</p>
   </div>}
   <nav className={styles.pagination} aria-label="Booking pages">
    <p>Page {page}</p>
    <div>{page > 1 && <a className="secondary-button" href={`/bookings?status=${status}&page=${page-1}`}>Previous</a>}{page*30 < total && <a className="secondary-button" href={`/bookings?status=${status}&page=${page+1}`}>Next</a>}</div>
   </nav>
  </section>
 </div>;
}
