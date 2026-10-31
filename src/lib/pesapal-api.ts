export const RENT_ORGANIZATION = "mama-mbugua-hostel";
export const RENT_ORIGIN = "https://mmambugua.studentshostels.com";
export type PesapalCredentials = { consumer_key: string; consumer_secret: string };
export type PesapalStatus = {
  status: string; status_code: number; payment_status_description: string;
  merchant_reference: string; amount: number; currency: string;
  confirmation_code: string; payment_method: string; created_date: string;
};

export function gatewayEnvironmentAllowed(environment: string) {
  return environment === "LIVE" && process.env.VERCEL_ENV === "production";
}

/** Fixed provider hosts. Never log bodies, credentials, tokens or payer details. */
export class PesapalApi {
  private token = "";
  private base: string;
  constructor(private credentials: PesapalCredentials, environment: "LIVE" | "SANDBOX", private transport: typeof fetch = fetch) {
    this.base = environment === "LIVE" ? "https://pay.pesapal.com/v3/api" : "https://cybqa.pesapal.com/pesapalv3/api";
  }
  private async call(path: string, body?: object, authenticated = true) {
    if (authenticated && !this.token) await this.authenticate();
    const response = await this.transport(this.base + path, {
      method: body ? "POST" : "GET", cache: "no-store", redirect: "error",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${this.token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw Error("PESAPAL_UNAVAILABLE");
    const data = await response.json();
    if (String(data.status) !== "200" || data.error?.code || data.error?.message || data.error?.type) throw Error("PESAPAL_REJECTED");
    return data;
  }
  async authenticate() {
    const data = await this.call("/Auth/RequestToken", this.credentials, false);
    if (typeof data.token !== "string" || !data.token) throw Error("PESAPAL_AUTH_FAILED");
    this.token = data.token;
  }
  async registerNotification() {
    const url = RENT_ORIGIN + "/api/payments/pesapal/ipn";
    const data = await this.call("/URLSetup/RegisterIPN", { url, ipn_notification_type: "POST" });
    if (!validTrackingId(data.ipn_id) || data.url !== url || Number(data.ipn_status) !== 1) throw Error("PESAPAL_IPN_FAILED");
    return data.ipn_id as string;
  }
  async submit(input: { id: string; amount: number; currency: string; notificationId: string; name: string; email: string | null; phone: string | null }) {
    const data = await this.call("/Transactions/SubmitOrderRequest", {
      id: input.id, amount: input.amount, currency: input.currency,
      description: "MMAMBUGUA HOSTEL rent", branch: "MMAMBUGUA HOSTEL",
      callback_url: RENT_ORIGIN + "/api/payments/pesapal/callback",
      notification_id: input.notificationId,
      billing_address: { first_name: input.name, email_address: input.email || "", phone_number: input.phone || "", country_code: "KE" },
    });
    if (data.merchant_reference !== input.id || !validTrackingId(data.order_tracking_id) || !safeCheckoutUrl(data.redirect_url, this.base.includes("cybqa"))) throw Error("PESAPAL_INVALID_ORDER");
    return { trackingId: data.order_tracking_id as string, checkoutUrl: data.redirect_url as string };
  }
  async status(trackingId: string): Promise<PesapalStatus> {
    if (!validTrackingId(trackingId)) throw Error("INVALID_TRACKING_ID");
    return this.call("/Transactions/GetTransactionStatus?orderTrackingId=" + encodeURIComponent(trackingId));
  }
}
export function validTrackingId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}
export function safeCheckoutUrl(value: unknown, sandbox = false): value is string {
  try { const url = new URL(String(value)); return url.protocol === "https:" && url.hostname === (sandbox ? "cybqa.pesapal.com" : "pay.pesapal.com") && !url.username && !url.password && !url.port; } catch { return false; }
}
