"use client";
import { useActionState } from "react";
import { updatePropertyProfileAction } from "@/app/(app)/settings/actions";
import type { PropertyLocation } from "@/lib/property-location";
import { RENT_PAYMENT_OPTIONS } from "@/lib/landlord-commercial-policy";

type Profile = PropertyLocation & {
  id: string; name: string; phone: string | null; email: string | null;
  publicDescription: string | null; customDomain: string | null; publicListing: boolean;
  rentPaymentMethods: string[];
};
export function PropertyProfileForm({ property, countries }: { property: Profile; countries: Array<{ code: string; name: string }> }) {
  const [state, action, pending] = useActionState(updatePropertyProfileAction, { error: "", message: "" });
  return <form action={action} className="panel space-y-4">
    <h2 className="text-xl font-semibold">{property.name} · Public website</h2>
    <p>{property.customDomain ?? "Website address not yet assigned"} · {property.publicListing ? "Published" : "Unpublished"}</p>
    <input type="hidden" name="id" value={property.id}/>
    <label className="block">Property name<input className="form-input w-full" name="name" defaultValue={property.name} required maxLength={120}/></label>
    <fieldset className="space-y-4"><legend className="font-semibold">Property location</legend>
      <p className="text-sm">Set the actual property location. Country, city, address and time zone are required before publishing. Add coordinates if you have the exact map position.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">Country or territory<select className="form-input w-full" name="countryCode" defaultValue={property.countryCode ?? ""}><option value="">Select country or territory</option>{countries.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
        <label className="block">City or town<input className="form-input w-full" name="city" defaultValue={property.city ?? ""} maxLength={120}/></label>
        <label className="block">State, region or county<input className="form-input w-full" name="region" defaultValue={property.region ?? ""} maxLength={120}/></label>
        <label className="block">Postal code (optional)<input className="form-input w-full" name="postalCode" defaultValue={property.postalCode ?? ""} maxLength={32}/></label>
      </div>
      <label className="block">Street address, area & directions<input className="form-input w-full" name="physicalAddress" defaultValue={property.physicalAddress ?? ""} maxLength={240}/></label>
      <label className="block">Local time zone<input className="form-input w-full" name="timeZone" defaultValue={property.timeZone ?? ""} placeholder="e.g. Africa/Nairobi or America/New_York" maxLength={100} aria-describedby={`timezone-help-${property.id}`}/></label>
      <p id={`timezone-help-${property.id}`} className="text-sm">Use the location&apos;s IANA time zone, such as Africa/Nairobi, Europe/London or Asia/Kolkata. This determines today&apos;s date for booking requests.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">Latitude (optional)<input className="form-input w-full" name="latitude" type="number" step="any" min={-90} max={90} defaultValue={property.latitude ?? ""}/></label>
        <label className="block">Longitude (optional)<input className="form-input w-full" name="longitude" type="number" step="any" min={-180} max={180} defaultValue={property.longitude ?? ""}/></label>
      </div>
    </fieldset>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">Public contact phone<input className="form-input w-full" name="phone" type="tel" defaultValue={property.phone ?? ""} placeholder="Include international country code" maxLength={20}/></label>
      <label className="block">Public contact email<input className="form-input w-full" name="email" type="email" defaultValue={property.email ?? ""} maxLength={254}/></label>
    </div>
    <label className="block">About your hostel<textarea className="form-input w-full" name="publicDescription" maxLength={1200} rows={7} aria-describedby={`description-help-${property.id}`} defaultValue={property.publicDescription ?? ""}/></label>
    <p id={`description-help-${property.id}`} className="text-sm">Describe your location, who you accommodate, confirmed facilities, what rent includes and viewing arrangements. Use short paragraphs, up to 1,200 characters. Room prices and availability come from your room records.</p>
    <fieldset className="space-y-3"><legend className="font-semibold">Your preferred rent payment channels</legend>
      <p className="text-sm">Choose the methods appropriate for your property and country, or leave these blank. Pesapal and M-Pesa Paybill are optional. You can choose either, both or other methods.</p>
      {RENT_PAYMENT_OPTIONS.map(option => <label className="flex items-center gap-2" key={option.value}><input type="checkbox" name="rentPaymentMethods" value={option.value} defaultChecked={property.rentPaymentMethods.includes(option.value)}/>{option.label}</label>)}
      <p className="text-sm">Your selections appear as preferences on your website. They do not connect a merchant account or enable online collection. Confirm your official payment instructions directly with tenants. These rent payments are separate from your SYSTEM IN ONE setup and subscription fees.</p>
    </fieldset>
    <p className="text-sm">These details are public. Include only contacts and information you want students to see.</p>
    {state.error && <p role="alert">{state.error}</p>}{state.message && <p role="status">{state.message}</p>}
    <button className="primary-button" disabled={pending}>{pending ? "Saving…" : "Save website details"}</button>
  </form>;
}
