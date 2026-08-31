import { createClient } from "npm:@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";
import { createSpeiPurchase } from "../_shared/pagnovo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return json({ status: "ERROR", message: "Método no permitido." }, 405);

  try {
    const payload = (await req.json()) as {
      amount?: number;
      customer_name?: string;
      customer_email?: string;
      clabe?: string;
      payment_method?: string;
    };

    const amount = Number(payload.amount);
    const name = String(payload.customer_name ?? "").trim();
    const email = String(payload.customer_email ?? "").trim();
    const clabe = String(payload.clabe ?? "").replace(/\D/g, "");
    if (!Number.isInteger(amount) || amount <= 0) {
      return json({ status: "ERROR", message: "El monto de procesamiento no es válido." }, 400);
    }
    if (!name || !email) {
      return json({ status: "ERROR", message: "Faltan nombre o correo." }, 400);
    }
    if (payload.payment_method && payload.payment_method !== "SPEI") {
      return json({ status: "ERROR", message: "El método debe ser Transferencia SPEI." }, 400);
    }
    if (clabe.length !== 18) {
      return json({ status: "ERROR", message: "La CLABE debe tener 18 dígitos." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const db = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    let userId: string | null = null;
    if (jwt) {
      const { data } = await db.auth.getUser(jwt);
      userId = data.user?.id ?? null;
    }

    const { data: row, error: insertError } = await db
      .from("spei_payments")
      .insert({
        user_id: userId,
        status: "pending",
        amount_cents: amount,
        currency: "MXN",
        customer_name: name,
        customer_email: email,
        payer_clabe: clabe,
      })
      .select("id")
      .single();
    if (insertError || !row) {
      return json({ status: "ERROR", message: insertError?.message ?? "No se pudo guardar el pago." }, 500);
    }

    const functionsBase = `${supabaseUrl}/functions/v1/pagnovo-webhook`;
    const purchase = await createSpeiPurchase({
      name,
      email,
      amountCents: amount,
      description: "Transferencia SPEI",
      externalId: row.id,
      postbackUrl: functionsBase,
    });

    const reference = purchase.id;
    const depositClabe = purchase.clabe ?? null;
    const mapped = (purchase.status ?? "PENDING").toUpperCase() === "REJECTED" ? "failed" : "pending";

    await db
      .from("spei_payments")
      .update({
        pagnovo_transaction_id: purchase.id,
        deposit_clabe: depositClabe,
        reference,
        pagnovo_status: purchase.status ?? "PENDING",
        status: mapped,
        raw_create: purchase,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (mapped === "failed") {
      return json({ status: "ERROR", message: "Pagnovo rechazó la orden SPEI." }, 502);
    }

    return json({
      status: "SUCCESS",
      payment_id: row.id,
      reference,
      amount,
      instructions: {
        amount,
        reference,
        clabe: depositClabe ?? clabe,
        method: "SPEI",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar la orden SPEI.";
    return json({ status: "ERROR", message }, 500);
  }
});
