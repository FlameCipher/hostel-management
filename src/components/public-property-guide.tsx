import Link from "next/link";
import { BedDouble, CalendarDays, ClipboardList, MapPin } from "lucide-react";

import { locationLabel, type PropertyLocation } from "@/lib/property-location";
import { rentPaymentLabels } from "@/lib/landlord-commercial-policy";

type PropertyDetails = PropertyLocation & {
  rentPaymentMethods: string[];
  name: string;
  physicalAddress: string | null;
  publicDescription: string | null;
  phone: string | null;
};

export function PropertyAbout({ property, hasPrivate, hasShared }: {
  property: PropertyDetails;
  hasPrivate: boolean;
  hasShared: boolean;
}) {
  const roomChoice = hasPrivate && hasShared ? "Private & shared rooms" : hasShared ? "Shared accommodation" : hasPrivate ? "Private accommodation" : "Explore your room options";
  return <section className="marketing-section hostel-about" id="about">
    <div className="marketing-section-head">
      <span>ABOUT THE HOSTEL</span>
      <h2>Welcome to {property.name}.</h2>
      <p className="hostel-description">{property.publicDescription || "Find student accommodation that fits your plans. Explore the available rooms and speak directly with hostel management before arranging your stay."}</p>
    </div>
    <div className="hostel-information-grid">
      <article><MapPin aria-hidden="true" size={24}/><h3>Find us</h3><p>{[property.physicalAddress,locationLabel(property)].filter(Boolean).join(" · ") || "Contact management for the hostel location and directions."}</p><a href="#location">Location & contact</a></article>
      <article><BedDouble aria-hidden="true" size={24}/><h3>{roomChoice}</h3><p>Compare the room types, listed rates and available student places below. Arrange a viewing to see which option suits you.</p><a href="#rooms">Compare accommodation</a></article>
      <article><CalendarDays aria-hidden="true" size={24}/><h3>Plan your stay</h3><p>Use the monthly and semester prices to plan your budget. Confirm the semester dates, any deposit and other charges before committing.</p><a href="#booking-guide">How booking works</a></article>
    </div>
  </section>;
}

export function PropertyBookingGuide({ phone, available }: { phone: string | undefined; available: number }) {
  return <section className="hostel-guide-band" id="booking-guide">
    <div className="marketing-section">
      <div className="marketing-section-head"><span>BOOKING & MOVE-IN</span><h2>From finding a room to moving in.</h2><p>A simple guide for students and parents planning accommodation.</p></div>
      <ol className="hostel-booking-steps">
        <li><span aria-hidden="true">01</span><h3>Compare your options</h3><p>Check private or shared room types, monthly and semester rates, and current availability. Contact management if you would like to view a room.</p></li>
        <li><span aria-hidden="true">02</span><h3>Send a room request</h3><p>Choose a room type and provide your name, mobile number and preferred move-in date. Save the request reference shown after submission.</p></li>
        <li><span aria-hidden="true">03</span><h3>Confirm with management</h3><p>Management reviews your request and confirms availability, charges, payment instructions and check-in arrangements. A request alone does not reserve a room.</p></li>
        <li><span aria-hidden="true">04</span><h3>Prepare for arrival</h3><p>Agree on your arrival time, ask which documents and personal items to bring, and review the accommodation terms with management.</p></li>
      </ol>
      <div className="hostel-booking-note"><ClipboardList aria-hidden="true" size={22}/><p><strong>Before paying:</strong> confirm the room and payment details directly with management. Sending this website&apos;s booking form does not collect payment or guarantee allocation.</p></div>
      <div className="portal-access-actions">{available > 0 && <Link className="primary-button" href="/book">Send a booking request</Link>}{phone && <a className="secondary-button" href={`tel:${phone}`}>Ask about a viewing</a>}</div>
    </div>
  </section>;
}

export function PropertyViewingChecklist() {
  return <section className="marketing-section hostel-viewing" id="viewing">
    <div className="marketing-section-head"><span>BEFORE YOU MOVE IN</span><h2>Make your viewing count.</h2><p>Use these questions to confirm the details that matter to you. Facilities and charges should be agreed with management for your chosen room.</p></div>
    <div className="hostel-information-grid">
      <article><h3>Your room & facilities</h3><ul><li>What furniture and bedding should I bring?</li><li>Which bathroom and cooking facilities serve this room?</li><li>How are water, electricity and internet provided and charged?</li></ul></article>
      <article><h3>Your budget & dates</h3><ul><li>Is a deposit or another charge payable?</li><li>Which dates does the semester price cover?</li><li>What are the payment, cancellation and refund arrangements?</li></ul></article>
      <article><h3>Day-to-day living</h3><ul><li>What are the access, visitor and shared-space rules?</li><li>How do I report a repair or contact management?</li><li>What arrangements apply during holidays and checkout?</li></ul></article>
    </div>
  </section>;
}

export function PropertyFaq({ property }: { property: PropertyDetails }) {
  const paymentChannels=rentPaymentLabels(property.rentPaymentMethods);
  const address=[property.physicalAddress,locationLabel(property)].filter(Boolean).join(", ");
  const questions = [
    { question: `Where is ${property.name}?`, answer: address ? `${address}. Contact management for exact directions and to agree on a viewing time.` : "Contact hostel management for the address, directions and a suitable viewing time." },
    { question: "How much does accommodation cost?", answer: "The Rooms & rates section shows the current monthly and semester rates for each listed room type. Shared-room rates are per student. Ask management to confirm any deposit, utilities or other charges and the dates covered by the semester rate." },
    { question: "Does submitting a request reserve my room?", answer: "No. You receive a booking-request reference for management to review. Availability and room allocation must be confirmed directly with management; no payment is taken by the request form." },
    { question: "Can I view the hostel before deciding?", answer: "Contact management to arrange a suitable time and confirm which rooms can be viewed. Ask about the facilities, what is included in the rent and what you need to bring." },
    { question: "How do I pay for my accommodation?", answer: `${paymentChannels.length ? `Management has selected these preferred rent payment channels: ${paymentChannels.join(", ")}. ` : ""}Ask management to confirm which channels are available, the amount due and the official payment instructions for your booking. Keep your payment reference and request confirmation that payment has been recorded against your account. This booking form does not take payment.` },
    { question: "How do existing students access their accounts?", answer: "Use the Student portal with the account details issued for your tenancy. Your account provides access to your hostel statements, receipts and messages. Contact management if you need help with access." },
    { question: "Who should I contact about repairs, rules or holidays?", answer: "Speak with hostel management about maintenance, visitors, holiday arrangements and checkout. Existing tenants can also use their student account to send a message to management." },
  ];
  return <section className="marketing-section hostel-faq" id="faq">
    <div className="marketing-section-head"><span>COMMON QUESTIONS</span><h2>A little more clarity before you book.</h2></div>
    <div className="hostel-faq-list">{questions.map(({ question, answer }) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
  </section>;
}
