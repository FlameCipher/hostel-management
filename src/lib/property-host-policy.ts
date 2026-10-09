export const DIRECTORY_HOST = "studentshostels.com";
export const MMAMBUGUA_HOST = "mmambugua.studentshostels.com";
// This accepts only managed property domains, never an arbitrary redirect URL.
export function managedPropertyHost(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 300) return null;
  const host = value.trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/$/, '');
  const candidate = host.includes('.') ? host : host + '.studentshostels.com';
  const match = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.studentshostels\.com$/.exec(candidate);
  return match && !['www', 'admin', 'api', 'login', 'support', 'mail', 'account', 'system', 'hostel', 'hostels'].includes(match[1]) ? candidate : null;
}
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

export function isPreviousMmambuguaHost(host: string | null) {
  return host === "mmabugua.studentshostels.com" || host === "mmambuguahostel.studentshostels.com";
}
