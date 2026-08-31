/** Pagnovo MXN/SPEI — same purchase shape as the working Next.js store. */

export const PAGNOVO_API = Deno.env.get("PAGNOVO_API_BASE") ?? "https://api.pagnovo.com";

export function pagnovoAuthHeader(): string {
  const secret = Deno.env.get("PAGNOVO_SECRET_KEY") ?? Deno.env.get("PAYMENT_API_KEY_PAGNOVO") ?? "";
  if (!secret) throw new Error("PAGNOVO_SECRET_KEY no está configurada.");
  const token = btoa(`secret:${secret}`);
  return `Basic ${token}`;
}

/** Same env as the working store: PAGNOVO_RESPONSIBLE_DOCUMENT (CNPJ/RFC, digits). */
export function pagnovoResponsibleDocument(): string {
  const fromEnv = (Deno.env.get("PAGNOVO_RESPONSIBLE_DOCUMENT") ?? "").replace(/\D/g, "");
  return fromEnv || "58097105000190";
}

/** Stable seller id in Pagnovo (not the payment UUID). Same document if unset. */
export function pagnovoResponsibleExternalId(): string {
  const fromEnv = (Deno.env.get("PAGNOVO_RESPONSIBLE_EXTERNAL_ID") ?? "").trim();
  return fromEnv || pagnovoResponsibleDocument();
}

function pagnovoErrorMessage(
  status: number,
  data: { message?: string; error?: string; statusCode?: number },
  text: string,
  traceId: string | null,
): string {
  const base = data.message || data.error || text || `Pagnovo HTTP ${status}`;
  const trace = traceId ? ` (trace: ${traceId})` : "";
  return base + trace;
}

export type PagnovoPurchase = {
  id: string;
  currency?: string;
  method?: string;
  status?: string;
  amount?: number;
  clabe?: string;
  costFee?: number;
  createdAt?: string;
};

export async function createSpeiPurchase(input: {
  name: string;
  email: string;
  amountCents: number;
  description: string;
  externalId: string;
  postbackUrl?: string;
  phone?: string;
}): Promise<PagnovoPurchase & { traceId: string | null }> {
  const phone = (input.phone ?? "").replace(/\D/g, "");
  const body: Record<string, unknown> = {
    name: input.name,
    email: input.email,
    amount: input.amountCents,
    currency: "MXN",
    paymentMethod: "SPEI",
    description: input.description,
    responsibleDocument: pagnovoResponsibleDocument(),
    responsibleExternalId: pagnovoResponsibleExternalId(),
    externalId: input.externalId,
  };
  if (input.postbackUrl) body.postbackUrl = input.postbackUrl;
  if (phone.length >= 8 && phone.length <= 12) body.phone = phone;

  const response = await fetch(`${PAGNOVO_API}/transactions/v2/purchase`, {
    method: "POST",
    headers: {
      Authorization: pagnovoAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const traceId = response.headers.get("x-trace-id");
  let data: PagnovoPurchase & { statusCode?: number; message?: string; error?: string };
  try {
    data = JSON.parse(text) as PagnovoPurchase & { statusCode?: number; message?: string; error?: string };
  } catch {
    throw new Error(pagnovoErrorMessage(response.status, {}, text, traceId));
  }
  if (!response.ok) {
    throw new Error(pagnovoErrorMessage(response.status, data, text, traceId));
  }
  return { ...data, traceId };
}

export async function getPagnovoTransaction(id: string): Promise<PagnovoPurchase> {
  const response = await fetch(`${PAGNOVO_API}/transactions/${encodeURIComponent(id)}`, {
    headers: { Authorization: pagnovoAuthHeader() },
  });
  const text = await response.text();
  let data: PagnovoPurchase & { message?: string };
  try {
    data = JSON.parse(text) as PagnovoPurchase & { message?: string };
  } catch {
    throw new Error(text || `Pagnovo HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(data.message || `Pagnovo HTTP ${response.status}`);
  }
  return data;
}

export function mapPagnovoStatus(status: string | undefined): "pending" | "approved" | "failed" {
  const value = (status ?? "").toUpperCase();
  if (value === "APPROVED" || value === "PAID" || value === "COMPLETED") return "approved";
  if (value === "REJECTED" || value === "FAILED" || value === "CANCELLED" || value === "CANCELED") {
    return "failed";
  }
  return "pending";
}
