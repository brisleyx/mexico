import { createClient } from "npm:@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";
import { getPagnovoTransaction, mapPagnovoStatus } from "../_shared/pagnovo.ts";
import { notifyUtmify, UTMIFY_ROW_COLUMNS, utmifyStatusForPayment } from "../_shared/utmify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "GET") return json({ status: "failed", payment_id: "" }, 405);

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return json({ payment_id: "", status: "failed" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data: row, error } = await db
    .from("spei_payments")
    .select(`pagnovo_transaction_id, status, ${UTMIFY_ROW_COLUMNS}`)
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return json({ payment_id: id, status: "failed" }, 404);
  }

  if (row.status === "approved" || row.status === "failed" || row.status === "refunded") {
    const status = row.status === "approved" ? "approved" : "failed";
    if (row.status === "approved" || row.status === "refunded" || row.status === "failed") {
      await notifyUtmify(db, row, utmifyStatusForPayment(row.status));
    }
    return json({ payment_id: row.id, status });
  }

  if (!row.pagnovo_transaction_id) {
    return json({ payment_id: row.id, status: "pending" });
  }

  try {
    const tx = await getPagnovoTransaction(row.pagnovo_transaction_id);
    const mapped = mapPagnovoStatus(tx.status);
    if (mapped !== "pending") {
      const paidAt = mapped === "approved" ? new Date().toISOString() : null;
      await db
        .from("spei_payments")
        .update({
          status: mapped,
          pagnovo_status: tx.status,
          paid_at: paidAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await notifyUtmify(db, { ...row, paid_at: paidAt ?? row.paid_at }, utmifyStatusForPayment(mapped));
    }
    return json({ payment_id: row.id, status: mapped });
  } catch {
    return json({ payment_id: row.id, status: "pending" });
  }
});
