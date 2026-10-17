"use client";
import { useActionState } from "react";
import { recordEmergencyCallTestAction } from "@/app/(app)/gate-readiness/emergency-actions";
import {MMAMBUGUA_EMERGENCY_PHONES} from "@/lib/hostel-emergency-contacts";
import {callTestLabels,type CallTestResult,type EmergencyCallTestRecord} from "@/lib/emergency-call-acceptance";

export function EmergencyCallAcceptance({records}:{records:EmergencyCallTestRecord[]}){
 return <section className="panel entity-form mt-5" aria-label="Emergency number real-device acceptance">
   <h2>Verify both hostel emergency phone lines</h2>
   <p>Place an actual test call from your own phone to each line. Record whether the intended responder answers.
      Neither a dial button nor a saved note proves round-the-clock staffing.</p>
   {MMAMBUGUA_EMERGENCY_PHONES.map((phone,line)=><EmergencyCallTestForm key={phone.href} line={line}
      last={records.find(x=>x.line===line)??null}/>)}
   <p className="muted-note">These results are manually reported and kept in the management audit record.
     They do not enable SOS, dispatch help, certify call delivery or change any student information.
     If a number does not answer, arrange a human responder and test again before advertising dependable coverage.</p>
 </section>;
}
function EmergencyCallTestForm({line,last}:{line:number;last:EmergencyCallTestRecord|null}){
 const [state,action,pending]=useActionState(recordEmergencyCallTestAction,{});
 const phone=MMAMBUGUA_EMERGENCY_PHONES[line];
 return <section className="panel entity-form" aria-label={"Test "+phone.display} style={{minWidth:0}}>
   <h3>{phone.label} · {phone.display}</h3>
   <a href={phone.href} className="primary-button no-underline"
      style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minHeight:48}}>
     Call {phone.display} now
   </a>
   <p>{last?
     <>Last recorded test: <strong>{callTestLabels[last.result]}</strong> · {last.createdAt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi",dateStyle:"medium",timeStyle:"short"})} · {last.testedBy}.
     This was staff-reported, not automatically verified.</>:
     "No real call test result has been recorded for this line."}</p>
   <form action={action} className="entity-form">
     <input name="line" type="hidden" value={line}/>
     <label className="field-group"><span>What happened when you called? *</span>
       <select name="result" defaultValue="" required>
         <option value="" disabled>Select observed call outcome</option>
         {(Object.entries(callTestLabels) as Array<[CallTestResult,string]>).map(([value,label])=>
           <option key={value} value={value}>{label}</option>)}
       </select>
     </label>
     <label className="field-group"><span>Factual call test note *</span>
       <textarea name="note" rows={2} required minLength={10} maxLength={280}
         placeholder="E.g. Spoke to designated caretaker, who confirmed their name and that they can receive urgent calls. Do not include passwords or private student information."/>
     </label>
     <label className="check-field"><input type="checkbox" name="personallyTested" required/>
       I personally called this number and am recording what actually happened, not assuming the line works.
     </label>
     <button className="secondary-button" disabled={pending} type="submit">
       {pending?"Recording test…":"Record this phone test"}
     </button>
     {state.error?<p role="alert" className="form-error">{state.error}</p>:null}
     {state.success?<p role="status" className="form-success">{state.success}</p>:null}
   </form>
 </section>;
}
