import { formatMoney } from "@/lib/currency";
import { managementCurrency } from "@/lib/organization-currency";
import Link from "next/link";
import { ExternalLink, Share2 } from "lucide-react";
import { VacancyShareActions } from "@/components/vacancy-share-actions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { requestPropertyContext } from "@/lib/property-host";
import { publishedWhere } from "@/lib/property-host-policy";
import { getEffectiveRoomStatus } from "@/lib/rooms";
export default async function VacancyCardPage() {
  const currency = await managementCurrency();
  const money = (value: number) => formatMoney(value, currency);
 const session=await requireSession();const context=await requestPropertyContext();
 const org=await db.organization.findUniqueOrThrow({where:{id:session.organizationId}});
 const property=await db.property.findFirst({where:{...publishedWhere(),organizationId:session.organizationId,...(context.property?{id:context.property.id}:{})},orderBy:{createdAt:"asc"}});
 if(!property?.customDomain)return <section className="panel entity-form"><h1>Digital vacancy card</h1><p>Publish your hostel website before sharing it with students.</p><Link href="/setup">Review website setup</Link></section>;
 const rooms=await db.room.findMany({where:{organizationId:session.organizationId,propertyId:property.id,roomType:{active:true,organizationId:session.organizationId}},include:{roomType:true,occupancies:{where:{status:"ACTIVE",organizationId:session.organizationId},select:{studentId:true}},breakReservations:{where:{status:{in:["RESERVED_FREE","CHARGED"]},intent:"RETURNING",clearedAt:null,organizationId:session.organizationId},select:{studentId:true}}}});
 const available=rooms.filter(room=>{const capacity=room.capacityOverride??room.roomType.defaultCapacity;const held=new Set([...room.occupancies,...room.breakReservations].map(item=>item.studentId)).size;return ["VACANT","PARTIALLY_OCCUPIED"].includes(getEffectiveRoomStatus(room.status,held,capacity));});
 const types=[...new Map(available.map(room=>[room.roomType.id,room.roomType])).values()];
 const publicUrl=`https://${property.customDomain}/`,imageUrl=`https://${property.customDomain}/api/vacancy-card/${org.id}`;
 return <div><div className="page-heading-row"><div><p className="eyebrow">Marketing & enquiries</p><h1>Digital vacancy card</h1><p>Advertise {property.name} using your own website address and current prices.</p></div><VacancyShareActions imageUrl={imageUrl} publicUrl={publicUrl} organizationName={property.name}/></div><section className="vacancy-share-card"><div className="vacancy-card-head"><div><p>ROOMS AVAILABLE</p><h2>{property.name}</h2><span>{property.physicalAddress||org.physicalAddress||"Accommodation enquiries welcome"}</span></div><strong>{available.length}<small> room{available.length===1?"":"s"} available</small></strong></div><div className="vacancy-rate-cards">{types.map(type=><article key={type.id}><strong>{type.name}</strong><span>{type.sharingMode==="PRIVATE"?"Private":"Shared accommodation"}</span><b>{money(Number(type.monthlyRate))}<small>/month</small></b><span>{money(Number(type.semesterRate))} / semester</span></article>)}</div><div className="vacancy-card-footer"><div className="vacancy-contact-block"><strong>{org.ownerName}</strong><span className="vacancy-contact-phones">{property.phone||org.phone}</span><span className="vacancy-contact-email">{property.email||org.email||""}</span></div><Link href={publicUrl} target="_blank">View my website <ExternalLink size={15}/></Link></div></section><div className="panel mt-5"><div className="panel-heading"><div><p className="panel-kicker">Shareable link</p><h2>Your hostel website</h2></div><Share2 size={20}/></div><p className="muted-note">Share this address in your adverts. Visitors see your own hostel name, pictures, contacts and live room availability.</p><code className="vacancy-public-url">{publicUrl}</code></div></div>;
}
