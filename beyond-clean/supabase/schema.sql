-- Beyond Clean database. Paste the whole file into Supabase → SQL Editor → Run.
-- Safe to re-run: it only creates what is missing and replaces functions/policies.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ owner

-- Who counts as the owner. Add your user after creating it in Authentication → Users:
--   insert into admins (user_id) select id from auth.users where email = 'you@example.com';
create table if not exists admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table admins enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

-- ------------------------------------------------------------------ settings

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict do nothing;
alter table settings enable row level security;

drop policy if exists "owner manages settings" on settings;
create policy "owner manages settings" on settings for all to authenticated
  using (is_admin()) with check (is_admin());

-- Anyone can read the settings (prices, times, contact details). There is nothing private in them.
create or replace function public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select data from settings where id = 1
$$;

-- ------------------------------------------------------------------ enquiries

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  -- Secret used in the customer's private status link.
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'replied', 'booked', 'declined', 'closed')),

  name text not null,
  email text not null,
  phone text not null,
  address text not null,
  postcode text not null,
  contact_pref text,

  property_type text,
  bedrooms int,
  bathrooms int,
  areas text[] not null default '{}',
  extras text[] not null default '{}',
  clean_type text,
  preferred jsonb not null default '[]'::jsonb, -- [{ "date": "2026-11-20", "window": "morning" }]
  flexible boolean not null default false,
  notes text,

  -- Owner's reply
  reply_message text,
  quote_pence int,
  booked_date date,
  booked_time text,
  replied_at timestamptz,
  accepted_at timestamptz,
  customer_declined boolean not null default false,
  owner_notes text
);
create index if not exists enquiries_created_idx on enquiries (created_at desc);
alter table enquiries enable row level security;

drop policy if exists "owner reads enquiries" on enquiries;
create policy "owner reads enquiries" on enquiries for select to authenticated using (is_admin());
drop policy if exists "owner updates enquiries" on enquiries;
create policy "owner updates enquiries" on enquiries for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "owner deletes enquiries" on enquiries;
create policy "owner deletes enquiries" on enquiries for delete to authenticated using (is_admin());

-- Customers never touch the table directly; they go through these functions.

create or replace function submit_enquiry(payload jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_token uuid;
  v_recent int;
begin
  if coalesce(trim(payload->>'name'), '') = '' or coalesce(trim(payload->>'email'), '') = ''
     or coalesce(trim(payload->>'phone'), '') = '' or coalesce(trim(payload->>'address'), '') = ''
     or coalesce(trim(payload->>'postcode'), '') = '' then
    raise exception 'Please fill in your name, email, phone, address and postcode.';
  end if;
  if (payload->>'email') !~ '^\S+@\S+\.\S+$' then
    raise exception 'Please add a valid email address.';
  end if;
  if length(coalesce(payload->>'notes', '')) > 2000 or length(payload::text) > 10000 then
    raise exception 'That enquiry is too long.';
  end if;
  -- Light spam guard: at most 5 enquiries an hour from one email address.
  select count(*) into v_recent from enquiries
   where lower(email) = lower(payload->>'email') and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'We already have your enquiry. We will be in touch soon.';
  end if;

  insert into enquiries (name, email, phone, address, postcode, contact_pref, property_type, bedrooms, bathrooms,
                         areas, extras, clean_type, preferred, flexible, notes)
  values (
    left(trim(payload->>'name'), 120), left(trim(payload->>'email'), 200), left(trim(payload->>'phone'), 40),
    left(trim(payload->>'address'), 300), upper(left(trim(payload->>'postcode'), 12)),
    left(payload->>'contact_pref', 20), left(payload->>'property_type', 40),
    nullif(payload->>'bedrooms', '')::int, nullif(payload->>'bathrooms', '')::int,
    coalesce((select array_agg(left(x, 40)) from jsonb_array_elements_text(coalesce(payload->'areas', '[]')) x), '{}'),
    coalesce((select array_agg(left(x, 40)) from jsonb_array_elements_text(coalesce(payload->'extras', '[]')) x), '{}'),
    left(payload->>'clean_type', 40),
    coalesce(payload->'preferred', '[]'::jsonb),
    coalesce((payload->>'flexible')::boolean, false),
    left(payload->>'notes', 2000)
  )
  returning token into v_token;
  return v_token;
end $$;

create or replace function get_enquiry(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(e) - 'owner_notes' - 'id' from enquiries e where token = p_token
$$;

create or replace function respond_to_quote(p_token uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v enquiries;
begin
  update enquiries
     set status = case when p_accept then 'booked' else 'declined' end,
         accepted_at = case when p_accept then now() else null end,
         customer_declined = not p_accept
   where token = p_token and status = 'replied'
  returning * into v;
  if v.id is null then raise exception 'This quote can no longer be changed.'; end if;
  return to_jsonb(v) - 'owner_notes' - 'id';
end $$;

-- ------------------------------------------------------------------ subscriptions (cleaning plans)

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'past_due', 'paused', 'cancelled')),

  name text not null,
  email text not null,
  phone text not null,
  address text not null,
  postcode text not null,
  notes text,

  visits_per_week int not null,
  hours_per_visit numeric not null,
  slots jsonb not null, -- [{ "day": 1, "start": "09:00" }], day 1 = Monday
  start_date date,
  monthly_pence int not null,

  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text,
  current_period_end timestamptz,
  owner_seen boolean not null default false,
  owner_notes text
);
alter table subscriptions enable row level security;

drop policy if exists "owner reads plans" on subscriptions;
create policy "owner reads plans" on subscriptions for select to authenticated using (is_admin());
drop policy if exists "owner updates plans" on subscriptions;
create policy "owner updates plans" on subscriptions for update to authenticated using (is_admin()) with check (is_admin());

-- How many plans use each weekly slot. Unpaid checkouts hold their slot for 30 minutes.
create or replace function slot_usage() returns table (day int, start text, used int)
language sql stable security definer set search_path = public as $$
  select (s->>'day')::int, s->>'start', count(*)::int
    from subscriptions, jsonb_array_elements(slots) s
   where status in ('active', 'past_due', 'paused')
      or (status = 'pending_payment' and created_at > now() - interval '30 minutes')
   group by 1, 2
$$;

create or replace function get_subscription(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(s) - 'owner_notes' - 'id' - 'stripe_customer_id' - 'stripe_subscription_id' - 'stripe_checkout_session_id'
    from subscriptions s where token = p_token
$$;

-- ------------------------------------------------------------------ access

revoke all on function submit_enquiry(jsonb), get_enquiry(uuid), respond_to_quote(uuid, boolean),
  slot_usage(), get_subscription(uuid), public_settings(), is_admin() from public;
grant execute on function submit_enquiry(jsonb), get_enquiry(uuid), respond_to_quote(uuid, boolean),
  slot_usage(), get_subscription(uuid), public_settings() to anon, authenticated;
grant execute on function is_admin() to authenticated;

-- Live updates for the owner inbox (the "ping").
do $$ begin
  alter publication supabase_realtime add table enquiries;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table subscriptions;
exception when duplicate_object then null; end $$;
