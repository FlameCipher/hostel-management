import { NextResponse } from "next/server";
// The former per-room uploader cannot bypass categorized, property-scoped uploads.
export async function POST() {
  return NextResponse.json({ error: "Manage building, compound and reusable room-type photos in My Website." }, { status: 410, headers: { "cache-control": "no-store" } });
}
