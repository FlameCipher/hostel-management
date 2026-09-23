import Link from "next/link";
import { ArrowRight, BadgeCheck, BedDouble, Building2, GraduationCap, MapPin, ShieldCheck, Smartphone, Wifi } from "lucide-react";

const rooms = [
  { name: "Single Room Private", monthly: "KES 4,500", semester: "KES 18,000", detail: "Private room · 1 student" },
  { name: "Single Room Shared", monthly: "KES 3,500", semester: "KES 14,000", detail: "Shared room · per student" },
  { name: "Bedsitter Private", monthly: "KES 7,000", semester: "KES 28,000", detail: "Private bedsitter · 1 student" },
  { name: "Bedsitter Shared", monthly: "KES 5,000", semester: "KES 20,000", detail: "Shared bedsitter · per student" },
];

export default function Home() {
  return (
    <main className="marketing-site">
      <nav className="marketing-nav">
        <Link className="marketing-brand" href="/"><strong>MMAMBUGUA HOSTEL</strong><span>JKUAT · JUJA</span></Link>
        <div className="marketing-links"><a href="#rooms">Rooms & rates</a><a href="#why">Why stay here</a><a href="#location">Location</a><Link className="marketing-login" href="/login">Management login</Link></div>
      </nav>

      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <span className="marketing-chip"><GraduationCap size={16}/> Student accommodation near JKUAT</span>
          <h1>A practical place to live, study and feel at home in Juja.</h1>
          <p>MMAMBUGUA HOSTEL provides affordable private and shared student accommodation approximately 500 metres from JKUAT Gate B, with clear pricing and a professionally managed room system.</p>
          <div className="marketing-actions"><a className="primary-button no-underline" href="#rooms">View rooms & rates <ArrowRight size={17}/></a><a className="secondary-button no-underline" href="#location">Plan a visit</a></div>
          <div className="marketing-trust"><span><BadgeCheck size={17}/> Clear room rates</span><span><Smartphone size={17}/> Mobile-friendly service</span><span><ShieldCheck size={17}/> Managed tenant records</span></div>
        </div>
        <div className="marketing-visual">
          <div className="marketing-photo-placeholder"><Building2 size={56}/><strong>Real MMAMBUGUA HOSTEL photos coming here</strong><span>Only verified property photos will be published.</span></div>
          <div className="marketing-location-card"><MapPin size={20}/><div><strong>Near JKUAT Gate B</strong><span>Juja, Kiambu County</span></div></div>
        </div>
      </section>

      <section className="marketing-section" id="rooms">
        <div className="marketing-section-head"><span>Accommodation</span><h2>Choose the room that fits your budget and study life.</h2><p>Simple rates with private and shared options. Semester pricing below is based on the hostel's current four-month semester structure.</p></div>
        <div className="marketing-room-grid">{rooms.map((room)=><article className="marketing-room-card" key={room.name}><div className="marketing-room-photo"><BedDouble size={34}/><span>Room photo</span></div><h3>{room.name}</h3><p>{room.detail}</p><div className="marketing-prices"><span><small>Monthly</small><strong>{room.monthly}</strong></span><span><small>Semester</small><strong>{room.semester}</strong></span></div><span className="marketing-availability">Contact hostel for current availability</span></article>)}</div>
      </section>

      <section className="marketing-section marketing-why" id="why">
        <div className="marketing-section-head"><span>Why MMAMBUGUA</span><h2>Student accommodation with straightforward management.</h2></div>
        <div className="marketing-feature-grid">
          <article><MapPin/><h3>Convenient for JKUAT</h3><p>Located approximately 500 metres from JKUAT Gate B, making the hostel practical for daily student life.</p></article>
          <article><BedDouble/><h3>Choice of rooms</h3><p>Private and shared single rooms and bedsitters give students different price and privacy options.</p></article>
          <article><Smartphone/><h3>Digital records</h3><p>Bookings, payments, receipts and tenant records are being brought into one professionally managed system.</p></article>
          <article><Wifi/><h3>Student-focused</h3><p>A long-established JKUAT student hostel being modernised for today's students and parents.</p></article>
        </div>
      </section>

      <section className="marketing-location" id="location"><div><span className="marketing-chip"><MapPin size={16}/> Juja, Kenya</span><h2>Close to university life.</h2><p>MMAMBUGUA HOSTEL is approximately 500 metres from JKUAT Gate B. Students and parents can contact the hostel to confirm availability and arrange a viewing before payment.</p><a className="primary-button no-underline" href="#rooms">Explore accommodation</a></div><div className="marketing-map-placeholder"><MapPin size={42}/><strong>JKUAT Gate B area</strong><span>Interactive directions will be added after the exact public map pin is verified.</span></div></section>

      <section className="marketing-cta"><div><h2>Looking for accommodation near JKUAT?</h2><p>Review the room options and rates, then contact MMAMBUGUA HOSTEL to confirm current availability and arrange your stay.</p></div><a className="secondary-button no-underline" href="#rooms">See room options</a></section>
      <footer className="marketing-footer"><div><strong>MMAMBUGUA HOSTEL</strong><span>Student accommodation · Juja, Kenya</span></div><div><a href="#rooms">Rooms</a><a href="#location">Location</a><Link href="/login">Staff login</Link></div><p>© {new Date().getFullYear()} MMAMBUGUA HOSTEL. All rights reserved.</p></footer>
    </main>
  );
}
