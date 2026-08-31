-- Pagos SPEI (Pagnovo). Aplique num projeto Supabase dedicado ao LaMantra.

create table if not exists public.spei_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  pagnovo_transaction_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'failed', 'refunded')),
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'MXN',
  customer_name text not null,
  customer_email text not null,
  payer_clabe text not null default '',
  deposit_clabe text,
  reference text,
  pagnovo_status text,
  last_event text,
  raw_create jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.pagnovo_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  environment text,
  transaction_id text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists spei_payments_pagnovo_tx_idx
  on public.spei_payments (pagnovo_transaction_id)
  where pagnovo_transaction_id is not null;

create index if not exists pagnovo_webhook_events_tx_idx
  on public.pagnovo_webhook_events (transaction_id);

alter table public.spei_payments enable row level security;
alter table public.pagnovo_webhook_events enable row level security;

create policy "spei_payments self read" on public.spei_payments
  for select using (auth.uid() is not null and auth.uid() = user_id);

-- Webhooks: só service role (sem policies de insert para anon/authenticated)
