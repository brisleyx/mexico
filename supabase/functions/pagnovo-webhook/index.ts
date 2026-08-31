import { createClient } from "npm:@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";
import { verifyPagnovoSignature } from "../_shared/hmac.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return json({ ok: false }, 405);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, message: "JSON inválido." }, 400);
  }

  const secret = Deno.env.get("PAGNOVO_WEBHOOK_SECRET") ?? "";
  const signature = req.headers.get("x-signature") ?? "";
  if (secret) {
    if (!signature) return json({ ok: false, message: "Missing signature" }, 401);
    const valid = await verifyPagnovoSignature(body, signature, secret);
    if (!valid) return json({ ok: false, message: "Invalid signature" }, 401);
  }

  const event = String(body.event ?? "");
  const environment = typeof body.environment === "string" ? body.environment : null;
  const payload = (body.payload && typeof body.payload === "object"
    ? (body.payload as Record<string, unknown>)
    : body) as Record<string, unknown>;
  const transactionId = String(payload.transaction_id ?? payload.transactionId ?? body.id ?? "");
  const externalId = String(payload.external_id ?? payload.externalId ?? "");

  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  await db.from("pagnovo_webhook_events").insert({
    event: event || "unknown",
    environment,
    transaction_id: transactionId || null,
    payload: body,
  });

  let next: "approved" | "failed" | "refunded" | null = null;
  if (event === "cashin.paid") next = "approved";
  if (event === "cashin.refunded") next = "refunded";
  if (event === "infraction.updated") next = "failed";

  if (next && (transactionId || externalId)) {
    const patch: Record<string, string> = {
      status: next === "refunded" ? "refunded" : next,
      last_event: event,
      updated_at: new Date().toISOString(),
    };
    if (next === "approved") patch.paid_at = new Date().toISOString();
    let query = db.from("spei_payments").update(patch);
    if (externalId) query = query.eq("id", externalId);
    else query = query.eq("pagnovo_transaction_id", transactionId);
    await query;
  }

  return json({ ok: true });
});
