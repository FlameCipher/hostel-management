import Link from "next/link";
import { ArrowRight, BedDouble, BookOpen, Droplets, GraduationCap, MapPin, ShieldCheck, ShoppingBag, Smartphone, Users, Wifi, Zap } from "lucide-react";

const rooms=[
 {name:"Single Room (Private)",monthly:"KES 4,500",semester:"KES 18,000",detail:"Private room · 1 student"},
 {name:"Single Room (Shared)",monthly:"KES 3,500",semester:"KES 14,000",detail:"Shared room · per student"},
 {name:"Bedsitter (Private)",monthly:"KES 7,000",semester:"KES 28,000",detail:"Private bedsitter · 1 student"},
 {name:"Bedsitter (Shared)",monthly:"KES 5,000",semester:"KES 20,000",detail:"Shared bedsitter · per student"},
];
const facilities=[
 [Wifi,"Wi-Fi service"],[ShieldCheck,"Managed environment"],[Droplets,"Water supply"],[Zap,"Electricity"],
 [BookOpen,"Study friendly"],[Users,"Student community"],[ShoppingBag,"Nearby services"],[Smartphone,"Digital records"]
] as const;

export default function Home(){
 return <main className="marketing-site approved-home">
  <div className="public-topbar"><span><MapPin size={14}/> Approx. 500 metres from JKUAT Gate B, Juja</span><span>Student accommodation · Private & shared rooms</span></div>
  <nav className="marketing-nav">
   <Link className="marketing-brand" href="/"><strong>MMAMBUGUA HOSTEL</strong><span>JKUAT · JUJA</span></Link>
   <div className="marketing-links"><a href="#home">Home</a><a href="#rooms">Rooms</a><a href="#facilities">Facilities</a><a href="#gallery">Gallery</a><a href="#location">Location</a><a href="#about">About</a><Link className="marketing-login" href="/login">Management Login</Link></div>
  </nav>

  <section className="approved-hero" id="home">
   <div className="approved-hero-copy"><span>STUDENT ACCOMMODATION IN JUJA</span><h1>MMAMBUGUA<br/>HOSTEL</h1><p>Affordable private and shared student accommodation approximately 500 metres from JKUAT Gate B, with straightforward rates and professional hostel management.</p><div className="marketing-actions"><a className="primary-button no-underline" href="#rooms"><BedDouble size={17}/> View Rooms</a><a className="secondary-button no-underline" href="#location">Plan a Visit <ArrowRight size={16}/></a></div></div>
   <div className="compound-showcase"><div className="compound-placeholder"><strong>MMAMBUGUA HOSTEL</strong><span>Professional property photography coming soon.</span></div></div>
  </section>

  <section className="public-benefits"><span><GraduationCap/>Close to JKUAT<small>Approx. 500 metres</small></span><span><ShieldCheck/>Professionally managed<small>Clear tenant records</small></span><span><Wifi/>Student focused<small>Connected living</small></span><span><Droplets/>Practical accommodation<small>Built for student life</small></span><span><Users/>Friendly community<small>Private & shared choices</small></span></section>

  <section className="marketing-section" id="rooms"><div className="marketing-section-head"><span>OUR ROOMS</span><h2>Comfortable options for every student.</h2><p>Choose private or shared accommodation with transparent monthly and semester rates.</p></div>
   <div className="marketing-room-grid">{rooms.map((r,i)=><article className="marketing-room-card" key={r.name}><div className={"marketing-room-photo room-visual-"+(i+1)}><BedDouble size={38}/><span>Interior presentation</span></div><h3>{r.name}</h3><p>{r.detail}</p><div className="marketing-prices"><span><small>Monthly</small><strong>{r.monthly}</strong></span><span><small>Semester</small><strong>{r.semester}</strong></span></div><a className="room-enquiry" href="#location">Check availability</a></article>)}</div>
  </section>

  <section className="facility-strip" id="facilities"><div className="marketing-section-head"><span>OUR FACILITIES</span><h2>Everything you need for student life.</h2></div><div className="facility-icons">{facilities.map(([Icon,label])=><div key={label}><Icon/><strong>{label}</strong></div>)}</div></section>

  <section className="marketing-section" id="gallery"><div className="marketing-section-head"><span>GALLERY</span><h2>Our hostel compound & rooms.</h2><p>The public gallery is designed for genuine MMAMBUGUA property photography. Verified compound images are never mixed with another property's exterior.</p></div><div className="gallery-coming-soon"><strong>Professional photography coming soon</strong><span>We are preparing a new set of high-quality photographs of the hostel, rooms and facilities.</span></div></section>

  <section className="public-split" id="location"><div><span className="marketing-chip"><MapPin size={16}/> OUR LOCATION</span><h2>Approximately 500 metres from JKUAT Gate B.</h2><p>Conveniently positioned in Juja for students who want to stay close to university. Confirm current room availability and arrange a viewing before making a booking.</p><div className="location-points"><span>✓ Close to JKUAT Gate B</span><span>✓ Access to Juja shops and services</span><span>✓ Private and shared accommodation</span><span>✓ Professionally managed records</span></div></div><div className="marketing-map-placeholder"><MapPin size={42}/><strong>MMAMBUGUA HOSTEL · JUJA</strong><span>Exact public directions will be activated after the hostel map pin is verified.</span></div></section>

  <section className="about-band" id="about"><div><span>ABOUT MMAMBUGUA HOSTEL</span><h2>A long-established student hostel being modernised for today's JKUAT community.</h2></div><p>Our goal is simple: clear accommodation choices, transparent rates and a more convenient experience for students, parents and hostel management.</p></section>
  <section className="marketing-cta"><div><h2>Looking for accommodation near JKUAT?</h2><p>Explore the room options and contact the hostel to confirm current availability.</p></div><a className="secondary-button no-underline" href="#rooms">View Room Options</a></section>
  <footer className="marketing-footer"><div><strong>MMAMBUGUA HOSTEL</strong><span>Student accommodation · Juja, Kenya</span></div><div><a href="#rooms">Rooms</a><a href="#facilities">Facilities</a><a href="#gallery">Gallery</a><a href="#location">Location</a><Link href="/login">Management Login</Link></div><p>© {new Date().getFullYear()} MMAMBUGUA HOSTEL. All rights reserved.</p></footer>
 </main>
}