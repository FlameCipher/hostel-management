import { requestPropertyContext } from "@/lib/property-host";
import { hostelAppIdentity, hostelAppManifest } from "@/lib/hostel-app";

export const dynamic = "force-dynamic";
export async function GET() {
  const { host, property } = await requestPropertyContext();
  const app = hostelAppIdentity(host, property);
  const headers = { "Cache-Control": "no-store", "Content-Type": "application/manifest+json", "X-Content-Type-Options": "nosniff" };
  return app ? Response.json(hostelAppManifest(app), { headers }) : new Response(null, { status: 404, headers });
}
