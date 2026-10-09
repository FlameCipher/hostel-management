import { ImageResponse } from "next/og";
import { requestPropertyContext } from "@/lib/property-host";
import { hostelAppIdentity } from "@/lib/hostel-app";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: requested } = await params;
  if (!["180", "192", "512"].includes(requested)) return new Response(null, { status: 404 });
  const { host, property } = await requestPropertyContext();
  const app = hostelAppIdentity(host, property);
  if (!app) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const size = Number(requested);
  // All artwork is inside the central mask-safe area, including the initials.
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: app.color, color: "white" }}>
      <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M3 21h18M10 21v-4h4v4M10 7h.01M14 7h.01M10 11h.01M14 11h.01"/>
      </svg>
      <div style={{ display: "flex", fontSize: size * 0.15, fontWeight: 700, lineHeight: 1.2, marginTop: size * 0.018 }}>{app.initials}</div>
    </div>,
    { width: size, height: size, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}
