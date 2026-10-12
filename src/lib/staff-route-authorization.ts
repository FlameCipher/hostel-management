import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { staffCanViewFinance } from "@/lib/staff-navigation-policy";

/** Revalidate the real server session on sensitive landlord finance routes.
 * Filtering the UI menu is not a security boundary.
 */
export async function requireStaffFinanceAccess() {
  const session = await requireSession();
  if(!staffCanViewFinance(session.role)) redirect("/visitors");
  return session;
}
