-- ProofVault free-tier Supabase foundation.
--
-- Apply this in the Supabase SQL editor or with the Supabase CLI after creating
-- a free Supabase project. Keep service-role keys out of the client app. The
-- browser/mobile app should only use the public anon key; row-level security
-- below limits each signed-in user to their own records.

create table if not exists public.proofvault_inventory_items (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  item jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.proofvault_incidents (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  incident jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.proofvault_locations (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  location jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.proofvault_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'premium')),
  batch_defaults jsonb not null default '{"location":"","room":""}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proofvault_inventory_items enable row level security;
alter table public.proofvault_incidents enable row level security;
alter table public.proofvault_locations enable row level security;
alter table public.proofvault_user_settings enable row level security;

create policy "Users manage their own inventory items"
  on public.proofvault_inventory_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own incidents"
  on public.proofvault_incidents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own locations"
  on public.proofvault_locations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own settings"
  on public.proofvault_user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values
  ('proofvault-item-photos', 'proofvault-item-photos', false),
  ('proofvault-documents', 'proofvault-documents', false)
on conflict (id) do nothing;

create policy "Users read their own item photos"
  on storage.objects
  for select
  using (bucket_id = 'proofvault-item-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users upload their own item photos"
  on storage.objects
  for insert
  with check (bucket_id = 'proofvault-item-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users update their own item photos"
  on storage.objects
  for update
  using (bucket_id = 'proofvault-item-photos' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'proofvault-item-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete their own item photos"
  on storage.objects
  for delete
  using (bucket_id = 'proofvault-item-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users read their own documents"
  on storage.objects
  for select
  using (bucket_id = 'proofvault-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users upload their own documents"
  on storage.objects
  for insert
  with check (bucket_id = 'proofvault-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users update their own documents"
  on storage.objects
  for update
  using (bucket_id = 'proofvault-documents' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'proofvault-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete their own documents"
  on storage.objects
  for delete
  using (bucket_id = 'proofvault-documents' and auth.uid()::text = (storage.foldername(name))[1]);

