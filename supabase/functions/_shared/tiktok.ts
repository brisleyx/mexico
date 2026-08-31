import { PROCESSING_CENTS } from "./speiAmount.ts";

type SpeiPaymentRow = {
  id: string;
  amount_cents?: number | null;
  customer_email?: string | null;
  tracking?: unknown;
  client_ip?: string | null;
};

type UtmifyStatus = "waiting_payment" | "paid" | "refused" | "refunded" | "chargedback";

const TIKTOK_EVENTS = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pickText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function eventName(status: UtmifyStatus): "InitiateCheckout" | "CompletePayment" | null {
  if (status === "waiting_payment") return "InitiateCheckout";
  if (status === "paid") return "CompletePayment";
  return null;
}

/** Same ids as the browser pixel so TikTok dedupes Pixel + Events API. */
function eventId(paymentId: string, status: UtmifyStatus): string {
  if (status === "waiting_payment") return `${paymentId}-checkout`;
  return paymentId;
}

export async function sendTikTokEvent(row: SpeiPaymentRow, status: UtmifyStatus): Promise<void> {
  const token = (Deno.env.get("TIKTOK_ACCESS_TOKEN") ?? "").trim();
  const pixelId = (Deno.env.get("TIKTOK_PIXEL_ID") ?? "").trim();
  if (!token || !pixelId) return;

  const event = eventName(status);
  if (!event) return;

  const raw = row.tracking && typeof row.tracking === "object"
    ? (row.tracking as Record<string, unknown>)
    : {};
  const ttclid = pickText(raw.ttclid) ?? pickText(raw.src);
  const userAgent = pickText(raw.user_agent);
  const email = String(row.customer_email ?? "").trim().toLowerCase();
  const totalCents = Number.isInteger(row.amount_cents) && (row.amount_cents ?? 0) > 0
    ? Number(row.amount_cents)
    : PROCESSING_CENTS;
  const value = totalCents / 100;

  const user: Record<string, unknown> = {};
  if (email) user.email = await sha256Hex(email);
  if (row.client_ip) user.ip = row.client_ip;
  if (userAgent) user.user_agent = userAgent;
  if (ttclid) user.ttclid = ttclid;

  try {
    const response = await fetch(TIKTOK_EVENTS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": token,
      },
      body: JSON.stringify({
        event_source: "web",
        event_source_id: pixelId,
        data: [
          {
            event,
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId(row.id, status),
            user,
            properties: {
              currency: "MXN",
              value,
              contents: [
                {
                  content_id: row.id,
                  content_type: "product",
                  content_name: "Transferencia SPEI",
                  quantity: 1,
                  price: value,
                },
              ],
            },
            page: { url: "https://bonustok.site/app/pago" },
          },
        ],
      }),
    });
    if (!response.ok) {
      console.error("tiktok event failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("tiktok event error", error);
  }
}
