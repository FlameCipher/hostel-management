import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { reservePropertyPhoto, completePropertyPhoto, PHOTO_MAX_BYTES } from "@/lib/property-photography";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as HandleUploadBody | null;
  if (!body || !["blob.generate-client-token", "blob.upload-completed"].includes(body.type)) return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  const session = body.type === "blob.generate-client-token" ? await getSession() : null;
  if (body.type === "blob.generate-client-token" && !session) return NextResponse.json({ error: "Sign in to upload photos." }, { status: 401 });
  try {
    const result = await handleUpload({ body, request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload ?? "null") as { propertyId?: unknown; publicConsent?: unknown; category?: unknown; roomTypeId?: unknown; confirmed?: unknown } | null;
        if (!payload || typeof payload.propertyId !== "string") throw Error("PHOTO_DENIED");
        const ticket = await reservePropertyPhoto(db, session, payload.propertyId, pathname, payload.publicConsent === true, payload);
        return { allowedContentTypes: ["image/jpeg", "image/png", "image/webp"], maximumSizeInBytes: PHOTO_MAX_BYTES, addRandomSuffix: false, allowOverwrite: false, validUntil: Date.now() + 5 * 60000, tokenPayload: JSON.stringify(ticket), ...(process.env.VERCEL_ENV === "production" ? {callbackUrl: "https://studentshostels.com/api/property-photos/upload"} : {}) };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => { await completePropertyPhoto(db, JSON.parse(tokenPayload ?? "null"), blob); },
    });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch { return NextResponse.json({ error: "Photo upload could not be confirmed. Check your access, storage connection and photo limit." }, { status: 400, headers: { "cache-control": "no-store" } }); }
}
