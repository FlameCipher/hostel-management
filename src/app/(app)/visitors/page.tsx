import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { residentStaff } from "@/lib/resident-access";
import { VisitorRecord } from "@/components/visitor-record";
import styles from "@/components/resident-services.module.css";

export const dynamic = "force-dynamic";
export default async function Visitors({
  searchParams,
}: { searchParams: Promise<{ page?: string; filter?: string; q?: string; property?: string }> }) {
  const session = await requireSession();
  if (!await residentStaff(db, session)) return <p>Visitor register unavailable.</p>;
  const params = await searchParams;
  const now = new Date();
  const page = Math.min(10000,Math.max(1,Math.floor(Number(params.page)||1)));
  const filter = ["EXPECTED","INSIDE","OVERDUE","EXPIRED","ALL"].includes(params.filter??"")
    ? params.filter! : "EXPECTED";
  const q=(params.q??"").trim().slice(0,120);
  const properties=await db.property.findMany({
    where:{organizationId:session.organizationId,active:true},
    select:{id:true,name:true},
    orderBy:{name:"asc"},
  });
  const propertyId=properties.some(p=>p.id===params.property)?params.property:undefined;
  const base={organizationId:session.organizationId,...(propertyId?{propertyId}:{})};
  const where={
    ...base,
    ...(filter==="EXPECTED"?{
      status:{in:["REQUESTED","APPROVED"]},expectedDeparture:{gte:now},
    }:filter==="INSIDE"?{status:"CHECKED_IN",checkedOutAt:null}
      :filter==="OVERDUE"?{status:"CHECKED_IN",checkedOutAt:null,expectedDeparture:{lt:now}}
      :filter==="EXPIRED"?{
        status:{in:["REQUESTED","APPROVED"]},expectedDeparture:{lt:now},
      }:{}),
    ...(q?{OR:[
      {visitorName:{contains:q,mode:"insensitive" as const}},
      {student:{fullName:{contains:q,mode:"insensitive" as const}}},
      {roomLabel:{contains:q,mode:"insensitive" as const}},
    ]}:{}),
  };
  const [visits,expected,inside,overdue,expired,finished] = await Promise.all([
    db.visitorRequest.findMany({
      where,
      orderBy:filter==="OVERDUE"?[{expectedDeparture:"asc"},{id:"asc"}]:
        [{createdAt:"desc"},{id:"desc"}],
      skip:(page-1)*30,take:31,
      include:{
        student:{select:{fullName:true}},
        property:{select:{name:true}},
      },
    }),
    db.visitorRequest.count({where:{...base,status:{in:["REQUESTED","APPROVED"]},expectedDeparture:{gte:now}}}),
    db.visitorRequest.count({where:{...base,status:"CHECKED_IN",checkedOutAt:null}}),
    db.visitorRequest.count({where:{...base,status:"CHECKED_IN",checkedOutAt:null,expectedDeparture:{lt:now}}}),
    db.visitorRequest.count({where:{...base,status:{in:["REQUESTED","APPROVED"]},expectedDeparture:{lt:now}}}),
    db.visitorRequest.count({where:{...base,status:"CHECKED_OUT"}}),
  ]);
  const liveRooms=visits.length?await db.occupancy.findMany({
    where:{
      organizationId:session.organizationId,
      id:{in:visits.map(v=>v.occupancyId)},
    },
    select:{
      id:true,status:true,studentId:true,
      room:{select:{number:true,propertyId:true}},
    },
  }):[];
  const roomByOccupancy=new Map(liveRooms.map(r=>[r.id,r]));
  const link=(n:number)=>"?"+new URLSearchParams({
    filter,q,page:String(n),...(propertyId?{property:propertyId}:{}),
  });
  return <div className={styles.page}>
    <div className="page-heading-row">
      <div><p className="eyebrow">Caretaker / security</p>
        <h1>Visitor operations</h1>
        <p>Arrival and departure verification for this hostel's tenants and their guests.</p>
      </div>
      <Link className="secondary-button" href="/assistant">System assistant &amp; alerts</Link>
    </div>
    <section className="room-summary-grid">
      <article className="compact-stat"><div><p>Expected requests</p><strong>{expected}</strong></div></article>
      <article className="compact-stat"><div><p>Checked in, exit unrecorded</p><strong>{inside}</strong></div></article>
      <article className="compact-stat"><div><p>Departure overdue</p><strong>{overdue}</strong></div></article>
      <article className="compact-stat"><div><p>Checked out</p><strong>{finished}</strong></div></article>
    </section>
    <div className="policy-banner mt-5"><div>
      <strong>Gate safety: never assume someone is physically inside.</strong>
      <p>"Checked in" means a verified entry was recorded; "departure overdue" means a verified exit has
        not yet been recorded. Staff must confirm the visitor and host identity, the current room, and actual arrival
        or departure before updating the register. A submitted request does not grant entry.</p>
    </div></div>
    <section className={`panel ${styles.card} mt-5`}>
      <form method="get">
        <div className={styles.grid}>
          <label className="field-group"><span>Queue</span>
            <select name="filter" defaultValue={filter}>
              <option value="EXPECTED">Expected / pending gate review ({expected})</option>
              <option value="INSIDE">Entry recorded, no departure ({inside})</option>
              <option value="OVERDUE">Departure unrecorded after planned time ({overdue})</option>
              <option value="EXPIRED">Visit window expired before entry ({expired})</option>
              <option value="ALL">All historical visitor records</option>
            </select>
          </label>
          <label className="field-group"><span>Hostel property</span>
            <select name="property" defaultValue={propertyId??""}>
              <option value="">All my hostel properties</option>
              {properties.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="field-group"><span>Visitor, host or room</span>
            <input name="q" defaultValue={q} maxLength={120}/>
          </label>
        </div>
        <button className="secondary-button">Show visitors</button>
      </form>
    </section>
    <section className="mt-5">
      {visits.length?visits.slice(0,30).map(v=>{
        const room=roomByOccupancy.get(v.occupancyId);
        const currentRoom=room?.room.number??null;
        const hostRoomChanged=Boolean(room&&(
          room.status!=="ACTIVE" ||
          room.studentId!==v.studentId ||
          room.room.propertyId!==v.propertyId ||
          room.room.number.toLocaleLowerCase()!==v.roomLabel.toLocaleLowerCase()
        ));
        return <VisitorRecord key={v.id} visit={v}
          currentRoomNumber={currentRoom} hostRoomChanged={hostRoomChanged}/>;
      }):<div className={`panel ${styles.card}`}>
        <p>No visitor records match this queue. Tenants with approved portal access can submit requests from My visitors.</p>
      </div>}
    </section>
    <nav className={styles.actions}>
      {page>1&&<Link href={link(page-1)}>Previous</Link>}
      {visits.length>30&&<Link href={link(page+1)}>Next</Link>}
    </nav>
  </div>;
}
