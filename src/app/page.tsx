import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BedDouble, MapPin, Phone } from "lucide-react";
import { PropertyAbout, PropertyBookingGuide, PropertyFaq, PropertyViewingChecklist } from "@/components/public-property-guide";
import { publicPropertyPhotos } from "@/lib/property-public-photos";
import { db } from "@/lib/db";
import { requestPropertyContext } from "@/lib/property-host";
import { normalizeHost, publishedWhere } from "@/lib/property-host-policy";
import { activeBreakHoldWhere } from "@/lib/room-status";
import { getEffectiveRoomStatus } from "@/lib/rooms";
import { countryName, countryOptions, locationLabel, propertyMapUrl } from "@/lib/property-location";
import { PLATFORM_SETUP_FEE, PLATFORM_MANUAL_PAYMENT } from "@/lib/landlord-commercial-policy";

const money = (value: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value);

export async function generateMetadata() {
  const { property } = await requestPropertyContext();
  if (!property) return { alternates: { canonical: "https://studentshostels.com/" } };
  const photo = (await publicPropertyPhotos(property.id, property.organizationId))[0];
  const description = property.publicDescription ?? `Rooms and accommodation at ${property.name}`;
  return {
    title: { absolute: property.name }, description,
    alternates: { canonical: `https://${property.customDomain}/` },
    openGraph: { title: property.name, description, siteName: property.name, url: `https://${property.customDomain}/`, ...(photo?.url ? { images: [{ url: photo.url, alt: photo.caption || property.name }] } : {}) },
    twitter: { card: photo?.url ? "summary_large_image" as const : "summary" as const, title: property.name, description, ...(photo?.url ? { images: [photo.url] } : {}) },
  };
}

export default async function Home({searchParams}:{searchParams:Promise<{country?:string;city?:string}>}) {
  const query=await searchParams;
  const country=typeof query.country==="string" && countryName(query.country.toUpperCase())?query.country.toUpperCase():"";
  const city=typeof query.city==="string"?query.city.trim().slice(0,120):"";
  const context = await requestPropertyContext();
  if (!context.shared && !context.property) notFound();
  const p = context.property;
  const title = p?.name ?? "StudentsHostels";
  const mapUrl=p?propertyMapUrl(p):null;
  const setupPrice=new Intl.NumberFormat("en-US",{style:"currency",currency:PLATFORM_SETUP_FEE.currency}).format(PLATFORM_SETUP_FEE.amountMinor/100);
  const [listings, rooms, photos] = await Promise.all([
    context.shared ? db.property.findMany({ where: { ...publishedWhere(), customDomain: { not: null }, ...(country?{countryCode:country}:{}), ...(city?{city:{contains:city,mode:"insensitive" as const}}:{}) }, select: { id: true, name: true, customDomain: true, physicalAddress: true, publicDescription: true, countryCode:true,city:true,region:true }, orderBy: { name: "asc" }, take: 500 }) : [],
    p ? db.room.findMany({
      where: { propertyId: p.id, organizationId: p.organizationId, property: publishedWhere(), roomType: { active: true, organizationId: p.organizationId } },
      select: {
        status: true, capacityOverride: true,
        roomType: { select: { id: true, name: true, defaultCapacity: true, monthlyRate: true, semesterRate: true, sharingMode: true } },
        occupancies: { where: { status: { in: ["ACTIVE", "RESERVED"] }, organizationId: p.organizationId }, select: { studentId: true } },
        breakReservations: { where: { ...activeBreakHoldWhere, organizationId: p.organizationId }, select: { studentId: true } },
      },
    }) : [],
    p ? publicPropertyPhotos(p.id, p.organizationId) : [],
  ]);
  const rates = new Map<string, { name: string; monthly: number; semester: number; available: number; sharingMode: "PRIVATE" | "SHARED" }>();
  for (const room of rooms) {
    const type = room.roomType;
    const held = new Set([...room.occupancies, ...room.breakReservations].map(x => x.studentId)).size;
    const capacity = room.capacityOverride ?? type.defaultCapacity;
    const available = ["VACANT", "PARTIALLY_OCCUPIED"].includes(getEffectiveRoomStatus(room.status, held, capacity)) ? Math.max(0, capacity - held) : 0;
    const row = rates.get(type.id) ?? { name: type.name, monthly: Number(type.monthlyRate), semester: Number(type.semesterRate), available: 0, sharingMode: type.sharingMode };
    row.available += available;
    rates.set(type.id, row);
  }
  const roomOptions = [...rates.entries()].sort((a, b) => a[1].monthly - b[1].monthly || a[1].name.localeCompare(b[1].name));
  const available = roomOptions.reduce((total, [, row]) => total + row.available, 0);
  const phone = p?.phone?.replace(/[^0-9+]/g, "");
  const hasPrivate = roomOptions.some(([, row]) => row.sharingMode === "PRIVATE");
  const hasShared = roomOptions.some(([, row]) => row.sharingMode === "SHARED");
  const heroDescription = p ? "Explore your room options, plan your budget and speak directly with hostel management about your stay." : "Discover participating hostels, compare accommodation and contact each property directly.";

  return <main className="marketing-site approved-home">
    <nav className="marketing-nav" aria-label="Main navigation">
      <Link className="marketing-brand" href="/"><strong>{title}</strong><span>{p ? "Student accommodation" : "Find your student home"}</span></Link>
      <div className="marketing-links">
        {p ? <><a href="#rooms">Rooms & rates</a><Link href="/book">Book a room</Link><a href="#location">Contact</a></> : <a href="https://studentshostels.com">All hostels</a>}
        <a href={p ? "/tenant/login" : "https://studentshostels.com/tenant/login"}>Student portal</a>
        <a className="marketing-login" href={p ? "/login" : "https://studentshostels.com/login"}>Management</a>
      </div>
    </nav>
    {p && <nav className="hostel-section-nav" aria-label="Explore this hostel"><a href="#about">About</a><a href="#rooms">Rooms & prices</a>{photos.length > 0 && <a href="#photos">Photos</a>}<a href="#booking-guide">How to book</a><a href="#viewing">Before moving in</a><a href="#faq">FAQs</a><a href="#location">Contact</a><Link href="/tenant/login">Student portal</Link></nav>}
    <section className="approved-hero" id="home">
      <div className="approved-hero-copy">
        <span>{p ? "YOUR STUDENT HOME" : "STUDENT ACCOMMODATION"}</span><h1>{title}</h1><p>{heroDescription}</p>
        {p?.physicalAddress && <p className="hostel-hero-location"><MapPin aria-hidden="true" size={19}/>{p.physicalAddress}{locationLabel(p) && ` · ${locationLabel(p)}`}</p>}
        <div className="marketing-actions"><a className="primary-button" href="#rooms"><BedDouble aria-hidden="true" size={18}/>{p ? "View rooms & availability" : "Explore hostels"}</a>{p && phone && <a className="secondary-button" href={`tel:${phone}`}>Call the hostel</a>}</div>
      </div>
      <div className="compound-showcase">
        {photos[0]?.url ? <div className="property-cover-image"><Image src={photos[0].url} alt={photos[0].caption || title} fill sizes="(max-width: 900px) 100vw, 50vw" unoptimized preload/></div> : p ? <aside className="hostel-at-a-glance" aria-label="Hostel at a glance">
          <span>ACCOMMODATION AT A GLANCE</span><h2>Plan your next semester.</h2>
          <dl><div><dt>Room options listed</dt><dd>{rates.size || "Contact management"}</dd></div><div><dt>Student places currently available</dt><dd>{available}</dd></div>{roomOptions.length > 0 && <div><dt>Listed monthly rates from</dt><dd>{money(roomOptions[0][1].monthly)}<small>Check the room type and charges below.</small></dd></div>}{phone && <div><dt>Speak with management</dt><dd><a href={`tel:${phone}`}>{p.phone}</a></dd></div>}</dl>
          <p>Get to know the room before you move in. Contact management to arrange a viewing and confirm the details of your stay.</p><a href="#booking-guide">See how booking works →</a>
        </aside> : <div className="compound-placeholder"><strong>{title}</strong><span>Independent hostels. One connected platform.</span></div>}
      </div>
    </section>
    {p && <PropertyAbout property={p} hasPrivate={hasPrivate} hasShared={hasShared}/>}
    <section className="marketing-section" id="rooms">
      <div className="marketing-section-head"><span>{p ? "ROOMS & RATES" : "HOSTEL DIRECTORY"}</span><h2>{p ? "Find the room that suits you." : "Start with the right location."}</h2><p>{p ? "Compare the listed monthly and semester prices. Shared-room rates are per student. Availability can change; management confirms your room before you pay." : "Search by country and city, then explore each hostel’s own website and contact its management team."}</p></div>
      {!p && <form className="hostel-directory-search" action="/#rooms" method="get"><label>Country or territory<select name="country" defaultValue={country}><option value="">All countries & territories</option>{countryOptions.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label>City or town<input name="city" defaultValue={city} maxLength={120} placeholder="Where would you like to live?"/></label><button className="primary-button" type="submit">Find hostels</button>{(country||city)&&<Link href="/#rooms">Clear filters</Link>}</form>}
      <div className="marketing-room-grid">
        {p ? roomOptions.map(([id, row]) => <article className="marketing-room-card hostel-room-detail" key={id}>
          <span className="hostel-room-type">{row.sharingMode === "SHARED" ? "Shared accommodation" : "Private accommodation"}</span><h3>{row.name}</h3>
          <p>{row.sharingMode === "SHARED" ? "A student place in shared accommodation. Ask management about sharing arrangements for the available room." : "A private accommodation option. Arrange a viewing to confirm the room layout and facilities."}</p>
          <div className="marketing-prices"><span><small>Monthly{row.sharingMode === "SHARED" ? " / student" : ""}</small><strong>{money(row.monthly)}</strong></span><span><small>Semester{row.sharingMode === "SHARED" ? " / student" : ""}</small><strong>{money(row.semester)}</strong></span></div>
          <p className="hostel-room-availability">{row.available > 0 ? `${row.available} student place${row.available === 1 ? "" : "s"} currently available` : "No student places currently listed as available"}</p>
          <div className="hostel-room-actions">{row.available > 0 && <Link className="room-enquiry" href={`/book?roomType=${encodeURIComponent(id)}`}>Request this room</Link>}{phone && <a className="hostel-text-link" href={`tel:${phone}`}>Ask about this room</a>}</div>
        </article>) : listings.filter(l => normalizeHost(l.customDomain) === l.customDomain).map(l => <article className="marketing-room-card" key={l.id}><h3>{l.name}</h3><p>{l.publicDescription}</p><p><strong>{locationLabel(l)}</strong></p><p>{l.physicalAddress}</p><a className="room-enquiry" href={`https://${l.customDomain}`}>Visit hostel website</a></article>)}
      </div>
      {p && !rates.size && <p>Contact management for current room options.</p>}{!p && !listings.length && <p>{country||city?"No published hostels match this location. Try another city or clear the filters.":"Published hostels will appear here."}</p>}
      {p && rates.size > 0 && <p className="hostel-rate-note">Before choosing, confirm the semester dates, deposit, utilities and any other charges with management. Rates shown here come from the hostel&apos;s current room records.</p>}
    </section>
    {p && photos.length > 0 && <section className="marketing-section" id="photos"><div className="marketing-section-head"><span>PICTURES</span><h2>Explore {p.name}.</h2><p>Browse photographs published by hostel management, then arrange a viewing of your preferred room.</p></div><div className="property-photo-grid">{photos.map(photo => <figure className="property-public-photo" key={photo.id}><div className="property-photo-preview"><Image src={photo.url!} alt={photo.caption || p.name} fill sizes="(max-width: 700px) 100vw, 33vw" unoptimized/></div>{photo.caption && <figcaption>{photo.caption}</figcaption>}</figure>)}</div></section>}
    {p && <><PropertyBookingGuide phone={phone} available={available}/><PropertyViewingChecklist/><PropertyFaq property={p}/>
      <section className="public-split hostel-contact" id="location">
        <div><span className="marketing-chip"><MapPin aria-hidden="true" size={16}/>LOCATION & CONTACT</span><h2>Let&apos;s plan your visit.</h2><h3>{p.name}</h3><p>{p.physicalAddress || "Contact management for directions."}</p>{locationLabel(p)&&<p><strong>{locationLabel(p)}</strong>{p.postalCode&&` · ${p.postalCode}`}</p>}{p.timeZone&&<p>Local time zone: {p.timeZone}</p>}{mapUrl&&<p><a className="secondary-button" href={mapUrl} target="_blank" rel="noreferrer">{p.latitude!=null?"Open map location":"Search address on map"} ↗</a></p>}<p>Get exact directions, agree on a viewing time, or ask about room availability and move-in arrangements.</p>{phone && <a className="primary-button" href={`tel:${phone}`}><Phone aria-hidden="true" size={18}/>{p.phone}</a>}{p.email && <p><a href={`mailto:${p.email}`}>{p.email}</a></p>}</div>
        <div className="hostel-portal-panel"><span className="hostel-kicker">ALREADY PART OF THE HOSTEL?</span><h2>Your hostel account.</h2><p><strong>Students:</strong> sign in to view statements, receipts and messages, or contact management through your account. Use the login details issued for your tenancy.</p><p><strong>Management:</strong> access rooms, student records, bookings and your website controls.</p><div className="portal-access-actions"><a className="primary-button" href="/login">Management portal</a><a className="secondary-button" href="/tenant/login">Student portal</a></div></div>
      </section>
    </>}
    {!p && <section className="marketing-section" id="landlords"><div className="marketing-section-head"><span>FOR LANDLORDS & PROPERTY TEAMS</span><h2>Your property. Your location. Your choices.</h2><p>Manage your hostel with StudentsHostels through SYSTEM IN ONE, with your own public website, rooms, student records and staff access.</p></div><div className="hostel-information-grid"><article><h3>Put your property on the map</h3><p>Publish your country, city, street address and directions. Set your local time zone, add photographs and show current room availability.</p></article><article><h3>Choose how you collect rent</h3><p>Pesapal and M-Pesa Paybill are optional landlord choices. Select either, both or another locally available method. Tenant rent is separate from the fees you pay to use the platform.</p></article><article><h3>One-time setup: US{setupPrice}</h3><p>A one-time platform setup fee of US{setupPrice} applies. Recurring subscription charges are separate; confirm your plan and billing terms in SYSTEM IN ONE before paying.</p><a href="https://systeminone.com/register">Create your business account →</a></article></div><div className="hostel-manual-payment"><h3>Manual M-Pesa payment & activation</h3><p>Contact SYSTEM IN ONE on <a href={`tel:${PLATFORM_MANUAL_PAYMENT.international}`}><strong>{PLATFORM_MANUAL_PAYMENT.display}</strong></a> to confirm the exact Kenyan-shilling amount for your US{setupPrice} setup fee and any separate subscription charges before paying.</p><ol><li>Create your business account, verify your email and request StudentsHostels access.</li><li>Confirm the amount and recipient, then use <strong>M-Pesa Send Money</strong> to <strong>{PLATFORM_MANUAL_PAYMENT.display}</strong>.</li><li>Share your transaction code, amount and business name on WhatsApp at the same number. Never share your PIN or one-time codes.</li><li>SYSTEM IN ONE verifies receipt, activates access and completes your hostel setup. Sending a reference does not activate access automatically.</li></ol><div className="portal-access-actions"><a className="primary-button" href={PLATFORM_MANUAL_PAYMENT.whatsapp} target="_blank" rel="noreferrer">Contact on WhatsApp</a><a className="secondary-button" href="https://systeminone.com/#hostel-payments">Payment instructions</a></div><p>This number is for platform fees and support. Tenant rent is paid through each landlord&apos;s own channels. If you cannot use Kenyan M-Pesa, contact us to agree on payment arrangements first.</p></div></section>}
    <footer className="marketing-footer"><div><strong>{title}</strong><span>{p ? "Student accommodation" : "Independent hostel websites"}</span></div>{p && <nav className="hostel-footer-links" aria-label="Footer navigation"><a href="#rooms">Rooms & rates</a><a href="#booking-guide">Booking guide</a><a href="#faq">FAQs</a><a href="#location">Contact</a></nav>}<p>© {new Date().getFullYear()} {title}</p></footer>
  </main>;
}
