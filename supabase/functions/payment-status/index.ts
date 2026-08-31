import { createClient } from "npm:@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";
import { getPagnovoTransaction, mapPagnovoStatus } from "../_shared/pagnovo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "GET") return json({ status: "failed", payment_id: "" }, 405);

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return json({ payment_id: "", status: "failed" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data: row, error } = await db
    .from("spei_payments")
    .select("id, status, pagnovo_transaction_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return json({ payment_id: id, status: "failed" }, 404);
  }

  if (row.status === "approved" || row.status === "failed" || row.status === "refunded") {
    const status = row.status === "approved" ? "approved" : "failed";
    return json({ payment_id: row.id, status });
  }

  if (!row.pagnovo_transaction_id) {
    return json({ payment_id: row.id, status: "pending" });
  }

  try {
    const tx = await getPagnovoTransaction(row.pagnovo_transaction_id);
    const mapped = mapPagnovoStatus(tx.status);
    if (mapped !== "pending") {
      await db
        .from("spei_payments")
        .update({
          status: mapped,
          pagnovo_status: tx.status,
          paid_at: mapped === "approved" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
    return json({ payment_id: row.id, status: mapped });
  } catch {
    return json({ payment_id: row.id, status: "pending" });
  }
});
