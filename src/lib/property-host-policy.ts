export const DIRECTORY_HOST = "studentshostels.com";
export const MMAMBUGUA_HOST = "mmambuguahostel.studentshostels.com";
export function normalizeHost(value: string | null): string | null {
  if (!value || value.length > 260) return null;
  const match = /^([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::[0-9]{1,5})?$/i.exec(value);
  if (!match || match[1].includes("..")) return null;
  return match[1].toLowerCase();
}
export function isSharedHost(host: string | null) {
  return !!host && ([DIRECTORY_HOST,"www.studentshostels.com","localhost","127.0.0.1"].includes(host) || /^[a-z0-9-]+\.vercel\.app$/.test(host));
}
export function isLegacyHost(host: string | null) {
  return host === "hostel.sampesa.com" || host === "hostels.systeminone.com";
}
export function publishedWhere() { return {active:true,publicListing:true,organization:{status:"ACTIVE" as const}}; }
export function accountScopeAllowed(host: string | null, propertyOrganizationId: string | null, sessionOrganizationId: string) {
  return isSharedHost(host) || (!!propertyOrganizationId && propertyOrganizationId === sessionOrganizationId);
}
