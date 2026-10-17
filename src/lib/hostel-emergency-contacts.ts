/**
 * MMAMBUGUA HOSTEL-specific telephone contacts supplied by the owner.
 * No assumed staff availability, duty assignment or automated SOS dispatch.
 */
export const MMAMBUGUA_EMERGENCY_ORGANIZATION_ID="mama-mbugua-hostel";
export const MMAMBUGUA_EMERGENCY_PHONES=[
 {label:"Hostel emergency line 1",display:"0714 464 701",href:"tel:+254714464701"},
 {label:"Hostel emergency line 2",display:"0722 634 013",href:"tel:+254722634013"},
] as const;
export const KENYA_EMERGENCY_PHONES=[
 {label:"National emergency 999",display:"999",href:"tel:999"},
 {label:"National emergency 112",display:"112",href:"tel:112"},
] as const;
export function hostelEmergencyPhones(organizationId:string|null|undefined) {
 return organizationId===MMAMBUGUA_EMERGENCY_ORGANIZATION_ID?MMAMBUGUA_EMERGENCY_PHONES:[];
}
