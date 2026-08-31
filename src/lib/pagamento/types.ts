/**
 * Our same-origin payment API (SPEI / MXN). Amounts are integer cents
 * (1 MXN = 100), same unit as AppState wallet / lastWithdrawalCents.
 *
 * Backend (Supabase Edge Functions, never the SPA):
 *   POST /transactions/v2/purchase  { amount, currency: "MXN", paymentMethod: "SPEI", name, email }
 *   GET  /transactions/:id
 *   Webhook v2 HMAC `x-signature` — cashin.paid → approved
 */

export type PaymentMethod = "SPEI";

export function paymentCreateUrl(): string {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  if (!base) throw new Error("VITE_SUPABASE_URL no está configurada.");
  return `${base}/functions/v1/payment-create`;
}

export function paymentStatusPath(id: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  if (!base) throw new Error("VITE_SUPABASE_URL no está configurada.");
  return `${base}/functions/v1/payment-status?id=${encodeURIComponent(id)}`;
}

export type CreatePaymentPayload = {
  /** Integer cents. */
  amount: number;
  customer_name: string;
  customer_email: string;
  /** 18-digit CLABE, digits only. */
  clabe: string;
  payment_method: PaymentMethod;
};

export type SpeiInstructions = {
  /** Integer cents. */
  amount: number;
  /** Clave de rastreo / Pagnovo reference. */
  reference: string;
  /** Destination deposit CLABE from Pagnovo when present. */
  clabe?: string;
  method: PaymentMethod;
};

export type CreatePaymentSuccess = {
  status: "SUCCESS";
  payment_id: string;
  reference: string;
  amount: number;
  instructions: SpeiInstructions;
};

export type CreatePaymentPending = {
  status: "PENDING";
  payment_id: string;
  reference?: string;
  amount: number;
};

export type CreatePaymentError = {
  status: "ERROR";
  message: string;
};

export type CreatePaymentResult = CreatePaymentSuccess | CreatePaymentPending | CreatePaymentError;

export type PaymentPollStatus = "pending" | "approved" | "failed";

export type PaymentStatusResult = {
  payment_id: string;
  status: PaymentPollStatus;
};

/** Pagnovo webhook v2 events the backend would persist. UI does not subscribe. */
export type PagnovoWebhookV2Event =
  | "cashin.paid"
  | "cashin.refunded"
  | "cashout.success"
  | "cashout.failed"
  | "cashout.returned"
  | "infraction.updated";
