/**
 * Pagnovo SPEI client (Mexican MXN account).
 *
 * Secrets, Basic Auth, HMAC webhook verification, and `@pagnovo/sdk` belong
 * on a backend. This SPA never talks to https://api.pagnovo.com.
 *
 * Live calls (VITE_PAGANOVO_MOCK=false):
 *   POST {VITE_SUPABASE_URL}/functions/v1/payment-create
 *   GET  {VITE_SUPABASE_URL}/functions/v1/payment-status?id=
 *
 * Mock is on unless `VITE_PAGANOVO_MOCK=false`.
 *
 * Mock approval rule: status stays `pending` until MOCK_APPROVE_AFTER_POLLS
 * total polls across all Confirmar attempts (polls accumulate). At 2s cadence
 * a 30s window is ~15 polls, so the first Confirmar times out pending and the
 * second attempt can reach approved. Analysis path uses the same counter.
 */

import { digitsOnly, isClabeLength } from "../clabe";
import { supabase } from "../supabase";
import { getTrackingForApi, trackIdentify, trackInitiateCheckout } from "../tracking";
import { PROCESSING_CENTS } from "./speiAmount";
import {
  paymentCreateUrl,
  paymentStatusPath,
  type CreatePaymentPayload,
  type CreatePaymentResult,
  type PaymentStatusResult,
} from "./types";

const USE_MOCK = import.meta.env.VITE_PAGANOVO_MOCK !== "false";

/** First ~15 polls fit in one 30s verify window; 18 lets the second click succeed. */
export const MOCK_APPROVE_AFTER_POLLS = 18;

export const PAYMENT_POLL_INTERVAL_MS = 2000;

/** Each Confirmar Crédito verify window. */
export const VERIFY_WINDOW_MS = 30_000;

function mockNetworkDelay(min = 400, max = 1200): Promise<void> {
  const ms = min + Math.floor(Math.random() * (max - min + 1));
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function mockPaymentId(): string {
  return `pn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function mockReference(): string {
  const n = String(Math.floor(Math.random() * 1_000_000_000_000)).padStart(12, "0");
  return `SPEI${n}`;
}

type MockPayment = {
  polls: number;
  amount: number;
  clabe: string;
  reference: string;
};

const mockLedger = new Map<string, MockPayment>();

function withTracking(payload: CreatePaymentPayload): CreatePaymentPayload {
  return { ...payload, tracking: payload.tracking ?? getTrackingForApi() };
}

function trackCreated(payload: CreatePaymentPayload, result: CreatePaymentResult) {
  if (result.status === "ERROR") return;
  trackIdentify(payload.customer_email, payload.customer_name);
  trackInitiateCheckout(result.payment_id, PROCESSING_CENTS / 100);
}

function validatePayload(payload: CreatePaymentPayload): string | null {
  if (!Number.isInteger(payload.amount) || payload.amount <= 0) {
    return "El monto de procesamiento no es válido.";
  }
  if (!payload.customer_name.trim()) return "Falta el nombre del beneficiario.";
  if (!payload.customer_email.trim()) return "Falta el correo del beneficiario.";
  if (payload.payment_method !== "SPEI") return "El método debe ser Transferencia SPEI.";
  const clabe = digitsOnly(payload.clabe);
  if (!isClabeLength(clabe)) return "La CLABE debe tener 18 dígitos.";
  return null;
}

function createKey(payload: CreatePaymentPayload): string {
  return [
    payload.customer_email.trim().toLowerCase(),
    digitsOnly(payload.clabe),
    String(payload.amount),
  ].join("|");
}

let inflight: { key: string; promise: Promise<CreatePaymentResult> } | null = null;

async function createPaymentMock(payload: CreatePaymentPayload): Promise<CreatePaymentResult> {
  await mockNetworkDelay();
  const invalid = validatePayload(payload);
  if (invalid) return { status: "ERROR", message: invalid };

  const clabe = digitsOnly(payload.clabe);
  const payment_id = mockPaymentId();
  const reference = mockReference();
  mockLedger.set(payment_id, { polls: 0, amount: payload.amount, clabe, reference });

  return {
    status: "SUCCESS",
    payment_id,
    reference,
    amount: payload.amount,
    instructions: {
      amount: payload.amount,
      reference,
      clabe,
      method: "SPEI",
    },
  };
}

async function getPaymentStatusMock(id: string): Promise<PaymentStatusResult> {
  await mockNetworkDelay(400, 900);
  const row = mockLedger.get(id);
  if (!row) return { payment_id: id, status: "failed" };
  row.polls += 1;
  if (row.polls < MOCK_APPROVE_AFTER_POLLS) {
    return { payment_id: id, status: "pending" };
  }
  return { payment_id: id, status: "approved" };
}

async function authHeaders(): Promise<HeadersInit> {
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
  let userJwt = "";
  try {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      userJwt = data.session?.access_token ?? "";
    }
  } catch {
    // Funnel guests often have no session; payment-create allows null user_id.
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: anon,
  };
  // Gateway still expects apikey. Bearer is optional user JWT, else anon —
  // never require a logged-in session (verify_jwt is off on these functions).
  const bearer = userJwt || anon;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return headers;
}

async function createPaymentLive(payload: CreatePaymentPayload): Promise<CreatePaymentResult> {
  try {
    const response = await fetch(paymentCreateUrl(), {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        ...payload,
        amount: PROCESSING_CENTS,
      }),
    });
    const body = (await response.json()) as CreatePaymentResult;
    if (!response.ok) {
      const message = body && "message" in body && typeof body.message === "string" && body.message.trim()
        ? body.message
        : "No se pudo generar la orden SPEI.";
      return { status: "ERROR", message };
    }
    return body;
  } catch {
    return { status: "ERROR", message: "No hay conexión con el servicio de pago." };
  }
}

async function getPaymentStatusLive(id: string): Promise<PaymentStatusResult> {
  const response = await fetch(paymentStatusPath(id), {
    method: "GET",
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error("No se pudo consultar el estado SPEI.");
  }
  return (await response.json()) as PaymentStatusResult;
}

export async function createPayment(payload: CreatePaymentPayload): Promise<CreatePaymentResult> {
  const withUtms = withTracking(payload);
  const key = createKey(withUtms);
  if (inflight?.key === key) return inflight.promise;

  const promise = (async () => {
    try {
      const result = USE_MOCK ? await createPaymentMock(withUtms) : await createPaymentLive(withUtms);
      trackCreated(withUtms, result);
      return result;
    } catch (error) {
      return {
        status: "ERROR" as const,
        message: error instanceof Error ? error.message : "No se pudo generar la orden SPEI.",
      };
    }
  })();

  inflight = { key, promise };
  try {
    return await promise;
  } finally {
    if (inflight?.promise === promise) inflight = null;
  }
}

export async function getPaymentStatus(id: string): Promise<PaymentStatusResult> {
  try {
    return USE_MOCK ? await getPaymentStatusMock(id) : await getPaymentStatusLive(id);
  } catch (error) {
    throw error instanceof Error ? error : new Error("No se pudo consultar el estado SPEI.");
  }
}
