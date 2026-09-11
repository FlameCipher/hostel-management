import { getSession } from "@/lib/auth/session";
import { deliverPaymentReceipt } from "@/lib/receipt-delivery";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await deliverPaymentReceipt(id, session.organizationId);
  if (result !== "email") {
    return Response.json(
      { error: result === "whatsapp" ? "This student has no email address." : "The PDF receipt could not be emailed." },
      { status: 422 },
    );
  }

  return Response.json({ delivered: true });
}
