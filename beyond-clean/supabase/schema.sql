-- Beyond Clean database. Paste the whole file into Supabase → SQL Editor → Run.
-- Safe to re-run: it only creates what is missing and replaces functions/policies.
--
-- Who can see what:
--   Owner    – a user listed in `admins`: everything.
--   Cleaner  – a user linked in `cleaners.user_id`: only their own jobs, through cleaner_schedule().
--   Customer – anyone with a private link (token), or signed in by email code: only their own records,
--              always through the functions below, never the tables directly.

create extension if not exists pgcrypto;

-- ================================================================== people

create table if not exists admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table admins enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

create table if not exists cleaners (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text,
  email text,
  user_id uuid unique references auth.users on delete set null,
  hourly_wage_pence int not null default 1200,
  colour text not null default '#2a7fc4',
  active boolean not null default true
);
alter table cleaners enable row level security;

-- The signed-in user's email, lower-cased (customers and cleaners sign in with an emailed code).
create or replace function my_email() returns text
language sql stable as $$
  select lower(nullif(auth.jwt() ->> 'email', ''))
$$;

-- A cleaner is whoever signs in with the email address the owner saved for them.
create or replace function my_cleaner_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from cleaners
   where active and (user_id = auth.uid() or (email is not null and lower(email) = my_email()))
   limit 1
$$;

drop policy if exists "owner manages cleaners" on cleaners;
create policy "owner manages cleaners" on cleaners for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "cleaner reads self" on cleaners;
create policy "cleaner reads self" on cleaners for select to authenticated using (id = my_cleaner_id());

-- ================================================================== settings

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

-- Prices, times and contact details are public. Keep secrets in Edge Function secrets, never here.
create or replace function public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select data from settings where id = 1
$$;

-- ================================================================== saved properties (landlords, Airbnb hosts)

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  label text not null,
  address text not null,
  postcode text not null,
  property_type text,
  bedrooms int,
  bathrooms int,
  access jsonb not null default '{}'::jsonb
);
create index if not exists properties_email_idx on properties (lower(email));
alter table properties enable row level security;
drop policy if exists "owner reads properties" on properties;
create policy "owner reads properties" on properties for select to authenticated using (is_admin());

-- ================================================================== enquiries (one-off cleans)

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(), -- secret in the customer's private link
  created_at timestamptz not null default now(),
  status text not null default 'new',
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
  reply_message text,
  quote_pence int,
  booked_date date,
  booked_time text,
  replied_at timestamptz,
  accepted_at timestamptz,
  customer_declined boolean not null default false,
  owner_notes text
);
alter table enquiries add column if not exists photos text[] not null default '{}';
alter table enquiries add column if not exists access jsonb not null default '{}'::jsonb;
alter table enquiries add column if not exists estimate_low_pence int;
alter table enquiries add column if not exists estimate_high_pence int;
alter table enquiries add column if not exists est_hours numeric;
alter table enquiries add column if not exists discount_code text;
alter table enquiries add column if not exists deposit_pence int not null default 0;
alter table enquiries add column if not exists paid_pence int not null default 0;
alter table enquiries add column if not exists cleaner_id uuid references cleaners on delete set null;
alter table enquiries add column if not exists property_id uuid references properties on delete set null;
alter table enquiries add column if not exists cancelled_at timestamptz;
alter table enquiries add column if not exists late_cancel boolean not null default false;
alter table enquiries add column if not exists completed_at timestamptz;
alter table enquiries drop constraint if exists enquiries_status_check;
alter table enquiries add constraint enquiries_status_check check (status in
  ('new', 'replied', 'awaiting_deposit', 'booked', 'completed', 'declined', 'cancelled', 'closed'));
create index if not exists enquiries_created_idx on enquiries (created_at desc);
create index if not exists enquiries_email_idx on enquiries (lower(email));
alter table enquiries enable row level security;

drop policy if exists "owner reads enquiries" on enquiries;
create policy "owner reads enquiries" on enquiries for select to authenticated using (is_admin());
drop policy if exists "owner updates enquiries" on enquiries;
create policy "owner updates enquiries" on enquiries for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "owner deletes enquiries" on enquiries;
create policy "owner deletes enquiries" on enquiries for delete to authenticated using (is_admin());

-- What a customer may see of their enquiry.
create or replace function enquiry_public(e enquiries) returns jsonb
language sql stable as $$
  select to_jsonb(e) - 'owner_notes' - 'id' - 'cleaner_id' - 'photos'
$$;

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
  if length(coalesce(payload->>'notes', '')) > 2000 or length(payload::text) > 20000 then
    raise exception 'That enquiry is too long.';
  end if;
  -- Light spam guard: at most 5 enquiries an hour from one email address.
  select count(*) into v_recent from enquiries
   where lower(email) = lower(payload->>'email') and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'We already have your enquiry. We will be in touch soon.';
  end if;

  insert into enquiries (name, email, phone, address, postcode, contact_pref, property_type, bedrooms, bathrooms,
                         areas, extras, clean_type, preferred, flexible, notes, photos, access,
                         estimate_low_pence, estimate_high_pence, est_hours, discount_code, property_id)
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
    left(payload->>'notes', 2000),
    -- Only paths inside the enquiry-photos bucket's "new/" folder are accepted.
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(payload->'photos', '[]')) x
               where x ~ '^new/[0-9a-f-]+/[0-9]+\.jpg$'), '{}'),
    coalesce(payload->'access', '{}'::jsonb),
    nullif(payload->>'estimate_low_pence', '')::int, nullif(payload->>'estimate_high_pence', '')::int,
    nullif(payload->>'est_hours', '')::numeric,
    upper(nullif(left(trim(payload->>'discount_code'), 30), '')),
    (select id from properties where id = nullif(payload->>'property_id', '')::uuid and lower(email) = lower(payload->>'email'))
  )
  returning token into v_token;
  return v_token;
end $$;

create or replace function get_enquiry(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select enquiry_public(e) from enquiries e where token = p_token
$$;

-- Accept → booked straight away, or awaiting a card deposit if the owner asked for one.
create or replace function respond_to_quote(p_token uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v enquiries;
begin
  update enquiries
     set status = case when not p_accept then 'declined'
                       when deposit_pence > paid_pence then 'awaiting_deposit' else 'booked' end,
         accepted_at = case when p_accept then now() else null end,
         customer_declined = not p_accept
   where token = p_token and status = 'replied'
  returning * into v;
  if v.id is null then raise exception 'This quote can no longer be changed.'; end if;
  if p_accept and v.discount_code is not null then
    update discount_codes set uses = uses + 1 where code = v.discount_code;
  end if;
  return enquiry_public(v);
end $$;

create or replace function cancel_booking(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v enquiries;
  v_notice numeric := coalesce((select (data->>'cancelNoticeHours')::numeric from settings where id = 1), 48);
  v_start timestamp;
begin
  select * into v from enquiries where token = p_token and status in ('booked', 'awaiting_deposit');
  if v.id is null then raise exception 'This booking can no longer be cancelled online. Please call us.'; end if;
  v_start := v.booked_date + coalesce(nullif(v.booked_time, ''), '09:00')::time;
  update enquiries set status = 'cancelled', cancelled_at = now(),
         late_cancel = (v_start - (now() at time zone 'Europe/London')) < make_interval(hours => v_notice::int)
   where id = v.id returning * into v;
  return enquiry_public(v);
end $$;

-- ================================================================== subscriptions (cleaning plans)

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
  visits_per_week numeric not null,
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
alter table subscriptions alter column visits_per_week type numeric;
alter table subscriptions add column if not exists access jsonb not null default '{}'::jsonb;
alter table subscriptions add column if not exists cleaner_id uuid references cleaners on delete set null;
alter table subscriptions add column if not exists referral_code text unique;
alter table subscriptions add column if not exists referred_by_code text;
alter table subscriptions add column if not exists referral_rewarded boolean not null default false;
alter table subscriptions add column if not exists discount_code text;
alter table subscriptions add column if not exists property_id uuid references properties on delete set null;
create index if not exists subscriptions_email_idx on subscriptions (lower(email));
alter table subscriptions enable row level security;

drop policy if exists "owner reads plans" on subscriptions;
create policy "owner reads plans" on subscriptions for select to authenticated using (is_admin());
drop policy if exists "owner updates plans" on subscriptions;
create policy "owner updates plans" on subscriptions for update to authenticated using (is_admin()) with check (is_admin());

-- Every plan gets a friendly referral code, e.g. SARAH-K7Q2.
create or replace function set_referral_code() returns trigger
language plpgsql as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(left(regexp_replace(split_part(new.name, ' ', 1), '[^A-Za-z]', '', 'g'), 8))
      || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
  end if;
  return new;
end $$;
drop trigger if exists subscriptions_referral_code on subscriptions;
create trigger subscriptions_referral_code before insert or update on subscriptions
  for each row execute function set_referral_code();
update subscriptions set referral_code = null where referral_code is null; -- gives older plans a code

-- Skips, moves, cover and extras for individual cleans of a plan.
create table if not exists plan_changes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  subscription_id uuid not null references subscriptions on delete cascade,
  kind text not null check (kind in ('skip', 'move', 'extra', 'cover')),
  visit_date date not null,
  visit_start text not null,
  new_date date,
  new_time text,
  status text not null default 'done' check (status in ('done', 'requested', 'confirmed', 'declined')),
  cleaner_id uuid references cleaners on delete set null,
  extra_id text,
  amount_pence int not null default 0, -- extra added to the next bill
  credit_pence int not null default 0, -- money taken off the next bill for a skipped clean
  note text,
  made_by text not null default 'owner' check (made_by in ('owner', 'customer'))
);
create unique index if not exists plan_changes_one_skip on plan_changes (subscription_id, visit_date, visit_start) where kind = 'skip';
create unique index if not exists plan_changes_one_cover on plan_changes (subscription_id, visit_date, visit_start) where kind = 'cover';
create index if not exists plan_changes_sub_idx on plan_changes (subscription_id);
alter table plan_changes enable row level security;
drop policy if exists "owner manages changes" on plan_changes;
create policy "owner manages changes" on plan_changes for all to authenticated using (is_admin()) with check (is_admin());

create or replace function plan_public(s subscriptions) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(s) - 'owner_notes' - 'stripe_customer_id' - 'stripe_subscription_id' - 'stripe_checkout_session_id'
    || jsonb_build_object('changes', coalesce((
         select jsonb_agg(to_jsonb(c) - 'cleaner_id' order by c.created_at)
           from plan_changes c where c.subscription_id = s.id and c.kind <> 'cover'), '[]'::jsonb))
$$;

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
  select plan_public(s) from subscriptions s where token = p_token
$$;

-- Customer updates key safe code, pets, parking etc. on a plan or a booking.
create or replace function update_access(p_token uuid, p_access jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(p_access::text) > 3000 then raise exception 'Too long.'; end if;
  update subscriptions set access = p_access where token = p_token;
  update enquiries set access = p_access where token = p_token and status in ('new', 'replied', 'awaiting_deposit', 'booked');
end $$;

-- ================================================================== discount codes and referrals

create table if not exists discount_codes (
  code text primary key check (code = upper(code)),
  created_at timestamptz not null default now(),
  description text,
  percent_off int check (percent_off between 1 and 100),
  amount_off_pence int check (amount_off_pence > 0),
  applies_to text not null default 'any' check (applies_to in ('any', 'plan', 'oneoff')),
  first_payment_only boolean not null default true, -- plans: discount the first month only
  active boolean not null default true,
  max_uses int,
  uses int not null default 0,
  expires_on date,
  check (percent_off is not null or amount_off_pence is not null)
);
alter table discount_codes enable row level security;
drop policy if exists "owner manages codes" on discount_codes;
create policy "owner manages codes" on discount_codes for all to authenticated using (is_admin()) with check (is_admin());

-- Checks a discount code or a customer's referral code. p_for: 'plan' or 'oneoff'.
create or replace function check_discount(p_code text, p_for text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d discount_codes;
  v_reward int := coalesce((select (data->>'referralRewardPence')::int from settings where id = 1), 1000);
begin
  select * into d from discount_codes where code = upper(trim(p_code));
  if d.code is not null then
    if not d.active or (d.expires_on is not null and d.expires_on < current_date)
       or (d.max_uses is not null and d.uses >= d.max_uses)
       or (d.applies_to <> 'any' and d.applies_to <> p_for) then
      return jsonb_build_object('valid', false, 'message', 'That code has expired or does not apply here.');
    end if;
    return jsonb_build_object('valid', true, 'code', d.code, 'kind', 'code', 'percent_off', d.percent_off,
      'amount_off_pence', d.amount_off_pence, 'first_payment_only', d.first_payment_only,
      'description', coalesce(d.description, case when d.percent_off is not null then d.percent_off || '% off' else '£' || (d.amount_off_pence / 100.0)::numeric(10,2) || ' off' end));
  end if;
  if exists (select 1 from subscriptions where referral_code = upper(trim(p_code)) and status in ('active', 'past_due', 'paused')) then
    return jsonb_build_object('valid', true, 'code', upper(trim(p_code)), 'kind', 'referral', 'amount_off_pence', v_reward,
      'first_payment_only', true, 'description', '£' || (v_reward / 100.0)::numeric(10,2) || ' off from a friend');
  end if;
  return jsonb_build_object('valid', false, 'message', 'We don''t recognise that code.');
end $$;

-- ================================================================== reviews and the satisfaction guarantee

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ref_token uuid not null, -- the enquiry or plan it is about
  kind text not null check (kind in ('oneoff', 'plan')),
  visit_date date,
  name text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  published boolean not null default false,
  owner_reply text,
  fix_requested boolean not null default false,
  fix_status text check (fix_status in ('open', 'booked', 'done'))
);
alter table reviews add column if not exists seen boolean not null default false;
create unique index if not exists reviews_one_per_visit on reviews (ref_token, coalesce(visit_date, '1900-01-01'::date));
alter table reviews enable row level security;
drop policy if exists "owner manages reviews" on reviews;
create policy "owner manages reviews" on reviews for all to authenticated using (is_admin()) with check (is_admin());

create or replace function submit_review(p_token uuid, p_rating int, p_comment text, p_visit_date date, p_fix boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_kind text;
begin
  select name, 'oneoff' into v_name, v_kind from enquiries where token = p_token and status in ('booked', 'completed');
  if v_name is null then
    select name, 'plan' into v_name, v_kind from subscriptions where token = p_token and status <> 'pending_payment';
  end if;
  if v_name is null then raise exception 'We could not find that clean.'; end if;
  if p_rating not between 1 and 5 then raise exception 'Please choose 1 to 5 stars.'; end if;
  insert into reviews (ref_token, kind, visit_date, name, rating, comment, fix_requested, fix_status)
  values (p_token, v_kind, p_visit_date, v_name, p_rating, left(p_comment, 2000), coalesce(p_fix, false),
          case when p_fix then 'open' end)
  on conflict (ref_token, coalesce(visit_date, '1900-01-01'::date)) do update
    set rating = excluded.rating, comment = excluded.comment,
        fix_requested = excluded.fix_requested or reviews.fix_requested,
        fix_status = coalesce(reviews.fix_status, excluded.fix_status);
end $$;

-- Published reviews for the home page: first name and initial only.
create or replace function public_reviews() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'average', (select round(avg(rating)::numeric, 1) from reviews where published),
    'count', (select count(*) from reviews where published),
    'items', coalesce((select jsonb_agg(r) from (
      select split_part(name, ' ', 1) || coalesce(' ' || left(nullif(split_part(name, ' ', 2), ''), 1) || '.', '') as name,
             rating, comment, created_at, owner_reply
        from reviews where published order by created_at desc limit 6) r), '[]'::jsonb))
$$;

-- ================================================================== customer account (sign in with an emailed code)

create or replace function my_account() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when my_email() is null then null else jsonb_build_object(
    'email', my_email(),
    'enquiries', coalesce((select jsonb_agg(enquiry_public(e) order by e.created_at desc) from enquiries e where lower(e.email) = my_email()), '[]'::jsonb),
    'plans', coalesce((select jsonb_agg(plan_public(s) order by s.created_at desc) from subscriptions s
                        where lower(s.email) = my_email() and s.status <> 'pending_payment'), '[]'::jsonb),
    'properties', coalesce((select jsonb_agg(to_jsonb(p) order by p.label) from properties p where lower(p.email) = my_email()), '[]'::jsonb)
  ) end
$$;

create or replace function save_property(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if my_email() is null then raise exception 'Please sign in first.'; end if;
  if coalesce(trim(p->>'label'), '') = '' or coalesce(trim(p->>'address'), '') = '' or coalesce(trim(p->>'postcode'), '') = '' then
    raise exception 'Please add a name, address and postcode.';
  end if;
  if (p->>'id') is not null then
    update properties set label = left(p->>'label', 80), address = left(p->>'address', 300), postcode = upper(left(p->>'postcode', 12)),
           property_type = left(p->>'property_type', 40), bedrooms = nullif(p->>'bedrooms', '')::int,
           bathrooms = nullif(p->>'bathrooms', '')::int, access = coalesce(p->'access', '{}'::jsonb)
     where id = (p->>'id')::uuid and lower(email) = my_email()
    returning id into v_id;
  else
    if (select count(*) from properties where lower(email) = my_email()) >= 50 then raise exception 'Too many saved properties.'; end if;
    insert into properties (email, label, address, postcode, property_type, bedrooms, bathrooms, access)
    values (my_email(), left(p->>'label', 80), left(p->>'address', 300), upper(left(p->>'postcode', 12)), left(p->>'property_type', 40),
            nullif(p->>'bedrooms', '')::int, nullif(p->>'bathrooms', '')::int, coalesce(p->'access', '{}'::jsonb))
    returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function delete_property(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from properties where id = p_id and lower(email) = my_email()
$$;

-- ================================================================== cleaner app

create table if not exists job_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_key text not null unique, -- 'plan:<plan id>:<date>:<time>' or 'enq:<enquiry id>'
  job_date date not null,
  cleaner_id uuid references cleaners on delete set null,
  subscription_id uuid references subscriptions on delete set null,
  enquiry_id uuid references enquiries on delete set null,
  clock_in timestamptz,
  clock_out timestamptz,
  checklist jsonb not null default '{}'::jsonb,
  photos_before text[] not null default '{}',
  photos_after text[] not null default '{}',
  notes text
);
create index if not exists job_logs_date_idx on job_logs (job_date);
alter table job_logs enable row level security;
drop policy if exists "owner manages logs" on job_logs;
create policy "owner manages logs" on job_logs for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "cleaner reads own logs" on job_logs;
create policy "cleaner reads own logs" on job_logs for select to authenticated using (cleaner_id = my_cleaner_id());
drop policy if exists "cleaner writes own logs" on job_logs;
create policy "cleaner writes own logs" on job_logs for insert to authenticated with check (cleaner_id = my_cleaner_id());
drop policy if exists "cleaner updates own logs" on job_logs;
create policy "cleaner updates own logs" on job_logs for update to authenticated
  using (cleaner_id = my_cleaner_id()) with check (cleaner_id = my_cleaner_id());

-- Everything a cleaner needs for their own jobs, and nothing else (no prices, no owner notes).
create or replace function cleaner_schedule() returns jsonb
language sql stable security definer set search_path = public as $$
  with me as (select * from cleaners where id = my_cleaner_id()),
  my_plans as (
    select s.* from subscriptions s, me
     where s.status in ('active', 'past_due', 'paused')
       and (s.cleaner_id = me.id or exists (select 1 from plan_changes c where c.subscription_id = s.id and c.kind = 'cover' and c.cleaner_id = me.id))
  )
  select case when not exists (select 1 from me) then null else jsonb_build_object(
    'me', (select jsonb_build_object('id', id, 'name', name) from me),
    'plans', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'status', status, 'name', name, 'phone', phone, 'address', address, 'postcode', postcode, 'notes', notes,
        'access', access, 'slots', slots, 'start_date', start_date, 'visits_per_week', visits_per_week,
        'hours_per_visit', hours_per_visit, 'cleaner_id', cleaner_id)) from my_plans), '[]'::jsonb),
    'changes', coalesce((select jsonb_agg(to_jsonb(c) - 'amount_pence' - 'credit_pence') from plan_changes c
        where c.subscription_id in (select id from my_plans)), '[]'::jsonb),
    'enquiries', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'status', e.status, 'name', e.name, 'phone', e.phone, 'address', e.address, 'postcode', e.postcode,
        'notes', e.notes, 'access', e.access, 'clean_type', e.clean_type, 'property_type', e.property_type,
        'bedrooms', e.bedrooms, 'bathrooms', e.bathrooms, 'areas', e.areas, 'extras', e.extras,
        'booked_date', e.booked_date, 'booked_time', e.booked_time, 'est_hours', e.est_hours, 'cleaner_id', e.cleaner_id))
      from enquiries e, me where e.cleaner_id = me.id and e.status in ('booked', 'completed')
        and e.booked_date > current_date - 14), '[]'::jsonb)
  ) end
$$;

-- ================================================================== reminders sent (stops duplicates)

create table if not exists message_log (
  kind text not null,
  ref text not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref)
);
alter table message_log enable row level security;

-- ================================================================== photo storage

do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('enquiry-photos', 'enquiry-photos', false, 5242880, array['image/jpeg']),
           ('job-photos', 'job-photos', false, 5242880, array['image/jpeg'])
    on conflict (id) do nothing;

    drop policy if exists "customers upload enquiry photos" on storage.objects;
    create policy "customers upload enquiry photos" on storage.objects for insert to anon, authenticated
      with check (bucket_id = 'enquiry-photos' and name ~ '^new/[0-9a-f-]+/[0-9]+\.jpg$');
    drop policy if exists "owner reads enquiry photos" on storage.objects;
    create policy "owner reads enquiry photos" on storage.objects for select to authenticated
      using (bucket_id = 'enquiry-photos' and is_admin());
    drop policy if exists "team uploads job photos" on storage.objects;
    create policy "team uploads job photos" on storage.objects for insert to authenticated
      with check (bucket_id = 'job-photos' and (is_admin() or my_cleaner_id() is not null));
    drop policy if exists "team reads job photos" on storage.objects;
    create policy "team reads job photos" on storage.objects for select to authenticated
      using (bucket_id = 'job-photos' and (is_admin() or my_cleaner_id() is not null));
  end if;
end $$;

-- ================================================================== access

revoke all on function submit_enquiry(jsonb), get_enquiry(uuid), respond_to_quote(uuid, boolean), cancel_booking(uuid),
  slot_usage(), get_subscription(uuid), public_settings(), is_admin(), my_cleaner_id(), update_access(uuid, jsonb),
  check_discount(text, text), submit_review(uuid, int, text, date, boolean), public_reviews(), my_account(),
  save_property(jsonb), delete_property(uuid), cleaner_schedule(), plan_public(subscriptions) from public;
grant execute on function submit_enquiry(jsonb), get_enquiry(uuid), respond_to_quote(uuid, boolean), cancel_booking(uuid),
  slot_usage(), get_subscription(uuid), public_settings(), update_access(uuid, jsonb), check_discount(text, text),
  submit_review(uuid, int, text, date, boolean), public_reviews() to anon, authenticated;
grant execute on function is_admin(), my_cleaner_id(), my_account(), save_property(jsonb), delete_property(uuid),
  cleaner_schedule() to authenticated;

-- Live updates for the owner inbox (the "ping").
do $$
declare t text;
begin
  foreach t in array array['enquiries', 'subscriptions', 'plan_changes', 'reviews'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
