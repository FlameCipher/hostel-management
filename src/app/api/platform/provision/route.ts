import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { provisionHostel } from "@/lib/platform-provisioning";
import { isHostelNameConflict, hostelNameTaken } from "@/lib/hostel-name";
import { db } from "@/lib/db";


function authorized(request: Request) {
  const expected = process.env.PLATFORM_PROVISIONING_SECRET;
  const supplied = request.headers.get("x-platform-provisioning-secret");
  if (!expected || !supplied) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  try {
    const result = await provisionHostel(db, body);
    return NextResponse.json(result, { status: result.status === "CREATED" ? 201 : 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (isHostelNameConflict(error)) return NextResponse.json({error:hostelNameTaken,code:"HOSTEL_NAME_TAKEN"},{status:409,headers:{"cache-control":"no-store"}});
    const code = error instanceof Error ? error.message : "FAILED";
    const status = code === "INVALID_REQUEST" ? 400 : code === "ACCESS_UNAVAILABLE" ? 403 : 503;
    return NextResponse.json({ error: status === 400 ? "Invalid provisioning request" : "Workspace setup unavailable" }, { status, headers: { "cache-control": "no-store" } });
  }
}
