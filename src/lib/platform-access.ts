import { platformRoleAllows } from "./platform-sso";

type Organization = { platformOrganizationId: string | null; platformProductCode: string | null };
// Legacy independent hostels retain their existing local access. Linked hostels check the control plane on every request.
export async function platformOrganizationAccess(organization: Organization, user?: { platformUserId: string | null; role: string }, fetcher: typeof fetch = fetch): Promise<boolean> {
  const id = organization.platformOrganizationId;
  if (!id) return true;
  const secret = process.env.HOSTEL_SSO_SECRET;
  if (!secret || organization.platformProductCode !== "STUDENTSHOSTELS") return false;
  try {
    const response = await fetcher("https://systeminone.com/api/hostel/access", {
      method: "POST", headers: { "content-type": "application/json", "x-hostel-sso-secret": secret },
      body: JSON.stringify({ platformOrganizationId: id, ...(user?.platformUserId ? { platformUserId: user.platformUserId } : {}) }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const value = await response.json();
    return value.active === true && value.platformOrganizationId === id && (!user?.platformUserId || (value.platformUserId === user.platformUserId && platformRoleAllows(user.role, value.role)));
  } catch { return false; }
}
