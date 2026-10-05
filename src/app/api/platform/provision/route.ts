import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const PRODUCT_CODE = "STUDENTSHOSTELS";

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

  const body = await request.json().catch(() => null) as null | {
    platformOrganizationId?: string;
    productCode?: string;
    organizationName?: string;
    ownerName?: string;
    phone?: string;
    email?: string;
  };

  if (!body?.platformOrganizationId || body.productCode !== PRODUCT_CODE || !body.organizationName || !body.ownerName || !body.phone) {
    return NextResponse.json({ error: "Invalid provisioning request" }, { status: 400 });
  }

  const existing = await db.organization.findUnique({
    where: { platformOrganizationId: body.platformOrganizationId },
    select: { id: true, name: true, platformOrganizationId: true, platformProductCode: true },
  });

  if (existing) {
    if (existing.platformProductCode !== PRODUCT_CODE) {
      return NextResponse.json({ error: "Platform identity product mismatch" }, { status: 409 });
    }
    return NextResponse.json({ organizationId: existing.id, status: "EXISTING" });
  }

  const organization = await db.organization.create({
    data: {
      platformOrganizationId: body.platformOrganizationId,
      platformProductCode: PRODUCT_CODE,
      name: body.organizationName,
      ownerName: body.ownerName,
      phone: body.phone,
      email: body.email ?? null,
      receiptPrefix: "SH",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  return NextResponse.json({ organizationId: organization.id, status: "CREATED" }, { status: 201 });
}
