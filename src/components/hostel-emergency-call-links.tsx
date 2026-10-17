import { PhoneCall } from "lucide-react";
import { hostelEmergencyPhones, KENYA_EMERGENCY_PHONES } from "@/lib/hostel-emergency-contacts";

/** Direct dial links, NOT an automatic emergency call or staff dispatch. */
export function HostelEmergencyCallLinks({
 organizationId,compact=false
}:{organizationId:string|null|undefined;compact?:boolean}){
 const phones=hostelEmergencyPhones(organizationId);
 if(!phones.length)return null;
 return <section className={compact?"mt-3":"panel entity-form mt-4"}
   aria-label="MMAMBUGUA HOSTEL emergency telephone contacts">
   <h2>Call MMAMBUGUA HOSTEL for urgent help</h2>
   <p>Choose either hostel emergency contact. Tap to open your phone dialer.
     A call is not automatically placed or answered by the hostel system.</p>
   <div className="heading-actions">
     {phones.map(contact=><a key={contact.href} href={contact.href}
       className="primary-button no-underline"
       style={{minHeight:48,display:"inline-flex",alignItems:"center",gap:8,justifyContent:"center"}}>
       <PhoneCall size={18} aria-hidden="true"/>
       {contact.display}
     </a>)}
   </div>
   <p className="muted-note">For police, fire, ambulance or immediate danger in Kenya,
     call <a href={KENYA_EMERGENCY_PHONES[0].href}>999</a> or
     {" "}<a href={KENYA_EMERGENCY_PHONES[1].href}>112</a>.
     The in-app SOS pilot is not a guaranteed emergency dispatch service.
     If nobody answers, use another safe way to seek urgent help.</p>
 </section>;
}
