import { organizationCurrency } from "@/lib/organization-currency";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requestPropertyContext } from "@/lib/property-host";
import { bookingOptions,createBookingTicket,bookingToday } from "@/lib/booking-requests";
import { BookingForm } from "./form";
export const dynamic="force-dynamic";
export const metadata={title:"Booking request",robots:{index:false,follow:false}};
export default async function BookPage({searchParams}:{searchParams:Promise<{roomType?:string}>}){
 const {property}=await requestPropertyContext();if(!property)notFound();
 const options=await bookingOptions(db,property.id,property.organizationId);const search=await searchParams;
 const selected=options.some(o=>o.id===search.roomType)?search.roomType!:options[0]?.id??"";
 return<main className="public-update-page booking-page"><section className="public-update-card public-update-card-wide"><Link href="/">{property.name}</Link><h1>Request a room</h1><p>Choose your room type and tell management when you would like to move in.</p>{options.length?<BookingForm currency={await organizationCurrency(property.organizationId)} ticket={createBookingTicket(property.id)} options={options} selected={selected} today={bookingToday(property.timeZone??"UTC")}/>:<section className="panel entity-form"><p>No available room types are listed right now.</p>{property.phone&&<a href={`tel:${property.phone.replace(/[^0-9+]/g,"")}`}>Contact management</a>}</section>}</section></main>;
}
