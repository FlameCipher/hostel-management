import { requirePlatformSession } from "@/lib/auth/platform-session";

/**
 * Server-only authorization boundary for SYSTEM IN ONE control-plane routes.
 * This intentionally does not accept Organization OWNER/ADMIN roles.
 */
export async function requireSuperAdmin() {
  const session = await requirePlatformSession();
  if (session.role !== "SUPER_ADMIN") {
    throw new Error("Platform administrator access required");
  }
  return session;
}
