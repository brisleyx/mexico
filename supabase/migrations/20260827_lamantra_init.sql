-- LaMantra schema
-- Aplique isto num projeto Supabase dedicado ao app (não no banco de doações/checkout).

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  beneficiary_name text not null default '',
  clabe text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_videos (
  id text primary key,
  partner text not null,
  title text not null,
  description text not null,
  duration_sec int not null,
  reward_cents int not null check (reward_cents > 0),
  src text not null,
  poster text,
  created_at timestamptz not null default now()
);

create table if not exists public.watch_credits (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null references public.partner_videos(id),
  reward_cents int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('credit', 'withdrawal')),
  cents int not null,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cents int not null check (cents > 0),
  clabe text not null,
  beneficiary_name text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.partner_videos enable row level security;
alter table public.watch_credits enable row level security;
alter table public.ledger enable row level security;
alter table public.withdrawals enable row level security;

create policy "profiles self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "videos public read" on public.partner_videos
  for select using (true);

create policy "credits self" on public.watch_credits
  for select using (auth.uid() = user_id);

create policy "credits insert self" on public.watch_credits
  for insert with check (auth.uid() = user_id);

create policy "ledger self" on public.ledger
  for select using (auth.uid() = user_id);

create policy "ledger insert self" on public.ledger
  for insert with check (auth.uid() = user_id);

create policy "withdrawals self" on public.withdrawals
  for select using (auth.uid() = user_id);

create policy "withdrawals insert self" on public.withdrawals
  for insert with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.partner_videos (id, partner, title, description, duration_sec, reward_cents, src, poster)
values
  (
    'casa-nopal',
    'Casa Nopal',
    'Tacos de temporada en CDMX',
    'Campaña de socio: receta y origen del nopal.',
    15,
    450,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg'
  ),
  (
    'taller-luna',
    'Taller Luna',
    'Joyería hecha en Taxco',
    'Proceso artesanal de un taller socio.',
    15,
    600,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerJoyrides.jpg'
  ),
  (
    'salsa-brava',
    'Salsa Brava',
    'El fuego de una receta familiar',
    'Marca socia de salsas en Jalisco.',
    15,
    350,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg'
  ),
  (
    'ruta-yucatan',
    'Ruta Yucatán',
    'Cenotes al amanecer',
    'Turismo socio · destino sureste.',
    15,
    800,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerMeltdowns.jpg'
  )
on conflict (id) do nothing;
