# StudentsHostels property websites

studentshostels.com is the public directory, mmambugua.studentshostels.com is the first property website, and systeminone.com manages platform access. Shared-login links use the apex so host-only authentication cookies and shared-login PKCE callback stay on the same origin.

Property.customDomain is unique globally. Public listings require active property, publicListing=true and ACTIVE organization. New properties stay unpublished. Assign verified lower-case hostname, public description and property contact details, connect that hostname to the Vercel project, verify HTTPS, then explicitly publish. Never map a host using forwarded headers or an organization ID supplied by a browser. Unknown hosts do not fall back to MMAMBUGUA.

The additive migration publishes only the existing known MMAMBUGUA property. No new landlord, room, subscription or account is created. Public rates and availability use both propertyId and organizationId. No student or financial details are serialized in advertising pages.

Password login at a property hostname scopes the organization. Shared-domain duplicate identifiers fail closed; use a property address or central mapped sign-in. Sessions recheck the hostname scope. Management remains organization-wide: staff roles are not property-specific. Owners/admins can edit their scoped property website description and contacts in Settings. Domain assignment and publishing stay centrally controlled. Landlord onboarding, automatic domain assignment/publishing controls, subscription billing per property and property-level staff permissions still need separate verification/implementation; this does not claim hundreds-landlord readiness.


New platform provisioning now creates an unpublished property with a short suggested subdomain. Address labels remove standalone hostel/hostels words; e.g. Sunrise Hostel → sunrise.studentshostels.com. Reserved/empty names receive a stable property suffix; a duplicate brand receives a deterministic identity suffix. Never silently rename existing client domains. MMAMBUGUA uses the corrected owner-approved mmambugua spelling; both previous subdomains permanently redirect while preserving path and query. Its official display name remains MMAMBUGUA HOSTEL.
