import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const PRODUCT_CODE = "STUDENTSHOSTELS";

function authorized(request: Request) {
  const expected = process.env.HEALTHFIX_CONNECTOR_SECRET;
  const supplied = request.headers.get("x-healthfix-connector-secret");
  if (!expected || !supplied) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      productCode: PRODUCT_CODE,
      service: "studentshostels",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      status: "HEALTHY",
      observedAt: new Date().toISOString(),
      modules: [
        { code: "application", name: "Application", status: "HEALTHY", checks: [{ code: "http", name: "HealthFix connector", status: "PASSING", checkType: "HTTP" }] },
        { code: "database", name: "Database", status: "HEALTHY", checks: [{ code: "connectivity", name: "Database connectivity", status: "PASSING", checkType: "DATABASE" }] },
        { code: "provisioning", name: "Platform provisioning", status: "UNKNOWN", checks: [] },
      ],
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({
      productCode: PRODUCT_CODE,
      service: "studentshostels",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      status: "DEGRADED",
      observedAt: new Date().toISOString(),
      modules: [
        { code: "application", name: "Application", status: "HEALTHY", checks: [{ code: "http", name: "HealthFix connector", status: "PASSING", checkType: "HTTP" }] },
        { code: "database", name: "Database", status: "DOWN", checks: [{ code: "connectivity", name: "Database connectivity", status: "FAILING", checkType: "DATABASE" }] },
        { code: "provisioning", name: "Platform provisioning", status: "UNKNOWN", checks: [] },
      ],
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
