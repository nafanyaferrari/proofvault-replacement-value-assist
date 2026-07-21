-- Billing-ready AI access controls. Apply after 0001.
--
-- The browser must never update these records directly. A secure server route
-- verifies the signed-in user and uses a service-role key to consume assists.

create table if not exists public.proofvault_ai_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  annual_assist_limit integer not null default 3 check (annual_assist_limit >= 0),
  assists_used integer not null default 0 check (assists_used >= 0),
  cycle_started_at timestamptz not null default now(),
  cycle_ends_at timestamptz not null default (now() + interval '365 days'),
  household_member_limit integer not null default 0 check (household_member_limit >= 0),
  active_device_limit integer not null default 1 check (active_device_limit >= 1),
  updated_at timestamptz not null default now()
);

create table if not exists public.proofvault_ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('photo_intake', 'valuation_lookup')),
  provider text,
  created_at timestamptz not null default now()
);

create table if not exists public.proofvault_household_members (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  unique (owner_user_id, member_user_id)
);

create table if not exists public.proofvault_active_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  label text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, device_id)
);

create index if not exists proofvault_ai_usage_events_user_created_idx
  on public.proofvault_ai_usage_events (user_id, created_at desc);

alter table public.proofvault_ai_entitlements enable row level security;
alter table public.proofvault_ai_usage_events enable row level security;
alter table public.proofvault_household_members enable row level security;
alter table public.proofvault_active_devices enable row level security;

create policy "Users read their own AI entitlement"
  on public.proofvault_ai_entitlements for select
  using (auth.uid() = user_id);

create policy "Users read their own AI usage events"
  on public.proofvault_ai_usage_events for select
  using (auth.uid() = user_id);

create policy "Users read their household membership"
  on public.proofvault_household_members for select
  using (auth.uid() = owner_user_id or auth.uid() = member_user_id);

create policy "Users read their own active devices"
  on public.proofvault_active_devices for select
  using (auth.uid() = user_id);

-- Every new account starts with the three-assist free trial. Existing accounts
-- are backfilled below so enforcement can be enabled without blocking them.
create or replace function public.proofvault_create_ai_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.proofvault_ai_entitlements (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists proofvault_create_ai_entitlement_on_signup on auth.users;
create trigger proofvault_create_ai_entitlement_on_signup
  after insert on auth.users
  for each row execute procedure public.proofvault_create_ai_entitlement();

insert into public.proofvault_ai_entitlements (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- Atomically consumes one assist only when the account has remaining access.
-- This function is intentionally service-role only: do not grant it to anon or
-- authenticated roles. Stripe/webhook code should provision Premium accounts
-- with annual_assist_limit = 500, household_member_limit = 1, and
-- active_device_limit = 3. Optional add-ons increment annual_assist_limit by 100.
create or replace function public.proofvault_consume_ai_assist(
  target_user_id uuid,
  requested_feature text,
  requested_provider text default null
)
returns table (allowed boolean, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  entitlement public.proofvault_ai_entitlements%rowtype;
begin
  select * into entitlement
  from public.proofvault_ai_entitlements
  where user_id = target_user_id
  for update;

  if not found then
    return query select false, 0;
    return;
  end if;

  if entitlement.cycle_ends_at <= now() then
    update public.proofvault_ai_entitlements
    set assists_used = 0,
        cycle_started_at = now(),
        cycle_ends_at = now() + interval '365 days',
        updated_at = now()
    where user_id = target_user_id
    returning * into entitlement;
  end if;

  if entitlement.assists_used >= entitlement.annual_assist_limit then
    return query select false, 0;
    return;
  end if;

  update public.proofvault_ai_entitlements
  set assists_used = assists_used + 1,
      updated_at = now()
  where user_id = target_user_id
  returning annual_assist_limit - assists_used into remaining;

  insert into public.proofvault_ai_usage_events (user_id, feature, provider)
  values (target_user_id, requested_feature, requested_provider);

  return query select true, remaining;
end;
$$;

revoke all on function public.proofvault_consume_ai_assist(uuid, text, text) from public;
