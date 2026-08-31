import { pagnovoPayerCpf, pagnovoPayerPhone } from "./cpf.ts";
import { PROCESSING_CENTS } from "./speiAmount.ts";
import { sendTikTokEvent } from "./tiktok.ts";

const UTMIFY_ORDERS = "https://api.utmify.com.br/api-credentials/orders";

export type UtmifyStatus = "waiting_payment" | "paid" | "refused" | "refunded" | "chargedback";

export type TrackingParameters = {
  src: string | null;
  sck: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  utm_term: string | null;
  ttclid?: string | null;
  user_agent?: string | null;
};

export type SpeiPaymentRow = {
  id: string;
  amount_cents?: number | null;
  customer_name?: string | null;
  customer_email?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
  tracking?: unknown;
  client_ip?: string | null;
  utmify_created_at?: string | null;
  utmify_status?: string | null;
};

export const UTMIFY_ROW_COLUMNS =
  "id, amount_cents, customer_name, customer_email, created_at, paid_at, tracking, client_ip, utmify_created_at, utmify_status";

export function emptyTracking(): TrackingParameters {
  return {
    src: null,
    sck: null,
    utm_source: null,
    utm_campaign: null,
    utm_medium: null,
    utm_content: null,
    utm_term: null,
  };
}

function pickText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function parseTracking(raw: unknown): TrackingParameters {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    src: pickText(src.src),
    sck: pickText(src.sck),
    utm_source: pickText(src.utm_source),
    utm_campaign: pickText(src.utm_campaign),
    utm_medium: pickText(src.utm_medium),
    utm_content: pickText(src.utm_content),
    utm_term: pickText(src.utm_term),
    ttclid: pickText(src.ttclid),
    user_agent: pickText(src.user_agent),
  };
}

function utmifyTracking(tracking: TrackingParameters) {
  return {
    src: tracking.src,
    sck: tracking.sck,
    utm_source: tracking.utm_source,
    utm_campaign: tracking.utm_campaign,
    utm_medium: tracking.utm_medium,
    utm_content: tracking.utm_content,
    utm_term: tracking.utm_term,
  };
}

/** Utmify requires UTC `YYYY-MM-DD HH:MM:SS`. Same string must be reused when the order status changes. */
export function utcStamp(iso?: string | Date | null): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return utcStamp(new Date());
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
}

export function utmifyStatusForPayment(status: "approved" | "failed" | "refunded"): UtmifyStatus {
  if (status === "approved") return "paid";
  if (status === "refunded") return "refunded";
  return "refused";
}

// deno-lint-ignore no-explicit-any
type UtmifyClient = { from: (table: string) => any };

/**
 * POST the order to Utmify. Never throws — SPEI must not fail because attribution is down.
 * Returns the createdAt stamp that was sent (persist it for later status updates).
 */
export async function sendUtmifyOrder(
  row: SpeiPaymentRow,
  status: UtmifyStatus,
): Promise<string | null> {
  const token = (Deno.env.get("UTMIFY_API_TOKEN") ?? "").trim();
  if (!token) return null;

  const email = String(row.customer_email ?? "").trim();
  const name = String(row.customer_name ?? "").trim();
  if (!email || !name) return null;

  const createdAt = row.utmify_created_at || utcStamp(row.created_at);
  const total = Number.isInteger(row.amount_cents) && (row.amount_cents ?? 0) > 0
    ? Number(row.amount_cents)
    : PROCESSING_CENTS;
  const isTest = (Deno.env.get("UTMIFY_TEST") ?? "").trim() === "true";

  const body: Record<string, unknown> = {
    orderId: row.id,
    platform: "BonusTok",
    // Utmify enum has no SPEI; pix is the same generate-and-wait cash-in pattern.
    paymentMethod: "pix",
    status,
    createdAt,
    approvedDate: status === "paid" || status === "refunded"
      ? utcStamp(row.paid_at ?? new Date())
      : null,
    refundedAt: status === "refunded" ? utcStamp(new Date()) : null,
    customer: {
      name,
      email,
      phone: pagnovoPayerPhone(email),
      document: pagnovoPayerCpf(email),
      country: "MX",
      ip: row.client_ip ?? null,
    },
    products: [
      {
        id: "spei-processing",
        name: "Transferencia SPEI",
        planId: null,
        planName: null,
        quantity: 1,
        priceInCents: total,
      },
    ],
    trackingParameters: utmifyTracking(parseTracking(row.tracking)),
    commission: {
      totalPriceInCents: total,
      gatewayFeeInCents: 0,
      userCommissionInCents: total,
      currency: "MXN",
    },
  };
  if (isTest) body.isTest = true;

  try {
    const response = await fetch(UTMIFY_ORDERS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": token,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error("utmify order failed", response.status, await response.text());
      return null;
    }
    return createdAt;
  } catch (error) {
    console.error("utmify order error", error);
    return null;
  }
}

export async function persistUtmifySent(
  db: UtmifyClient,
  paymentId: string,
  status: UtmifyStatus,
  createdAt: string,
) {
  try {
    await db.from("spei_payments").update({
      utmify_status: status,
      utmify_created_at: createdAt,
      updated_at: new Date().toISOString(),
    }).eq("id", paymentId);
  } catch (error) {
    console.error("utmify persist error", error);
  }
}

export async function notifyUtmify(
  db: UtmifyClient,
  row: SpeiPaymentRow,
  status: UtmifyStatus,
) {
  if (row.utmify_status === status) return;
  const [createdAt] = await Promise.all([
    sendUtmifyOrder(row, status),
    sendTikTokEvent(row, status),
  ]);
  if (createdAt) await persistUtmifySent(db, row.id, status, createdAt);
}
