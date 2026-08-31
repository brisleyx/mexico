-- Utmify API: store landing UTMs + the exact createdAt stamp sent to Utmify.

alter table public.spei_payments
  add column if not exists tracking jsonb,
  add column if not exists client_ip text,
  add column if not exists utmify_status text,
  add column if not exists utmify_created_at text;
