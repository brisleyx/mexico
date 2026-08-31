/** Pagnovo MXN/SPEI — same purchase endpoint as PIX, currency MXN. */

export const PAGNOVO_API = Deno.env.get("PAGNOVO_API_BASE") ?? "https://api.pagnovo.com";

export function pagnovoAuthHeader(): string {
  const secret = Deno.env.get("PAGNOVO_SECRET_KEY") ?? Deno.env.get("PAYMENT_API_KEY_PAGNOVO") ?? "";
  if (!secret) throw new Error("PAGNOVO_SECRET_KEY no está configurada.");
  const token = btoa(`secret:${secret}`);
  return `Basic ${token}`;
}

export type PagnovoPurchase = {
  id: string;
  currency?: string;
  method?: string;
  status?: string;
  amount?: number;
  clabe?: string;
  createdAt?: string;
};

export async function createSpeiPurchase(input: {
  name: string;
  email: string;
  amountCents: number;
  description: string;
  externalId: string;
  postbackUrl?: string;
}): Promise<PagnovoPurchase> {
  const response = await fetch(`${PAGNOVO_API}/transactions/v2/purchase`, {
    method: "POST",
    headers: {
      Authorization: pagnovoAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      amount: input.amountCents,
      currency: "MXN",
      paymentMethod: "SPEI",
      description: input.description,
      responsibleExternalId: input.externalId,
      externalId: input.externalId,
      postbackUrl: input.postbackUrl,
    }),
  });
  const text = await response.text();
  let data: PagnovoPurchase & { statusCode?: number; message?: string };
  try {
    data = JSON.parse(text) as PagnovoPurchase & { statusCode?: number; message?: string };
  } catch {
    throw new Error(text || `Pagnovo HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(data.message || `Pagnovo HTTP ${response.status}`);
  }
  return data;
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
