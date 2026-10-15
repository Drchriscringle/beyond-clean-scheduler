-- ============================================================
-- Pocket Money — Supabase schema
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  currency    text not null default 'GBP', -- ISO 4217 code, formatted client-side via Intl.NumberFormat
  created_at  timestamptz not null default now(),
  -- Billing (Stripe Checkout, subscriptions). subscription_status mirrors
  -- Stripe's own status strings ('trialing', 'active', 'past_due',
  -- 'canceled', …) plus the app-only default 'trial' before any Stripe
  -- customer exists yet. Written only by the stripe-webhook edge function
  -- (and trial_ends_at once, by create_family()) — never directly by the
  -- client, hence no update policy covering these columns below.
  stripe_customer_id     text,
  subscription_status    text not null default 'trial',
  trial_ends_at          timestamptz
);

-- A parent is a real Supabase auth user linked to one family.
-- Children are NOT separate auth users (see design note at bottom) —
-- they're rows a parent manages, unlocked in the UI by a PIN.
create table parents (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner', 'co_parent')),
  created_at  timestamptz not null default now()
);

create table children (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  name        text not null,
  avatar      text not null default '🙂',
  pin         text not null default '0000', -- 4-digit device PIN, UI gate only — not a security boundary
  jar_save    int not null default 40 check (jar_save between 0 and 100),
  jar_spend   int not null default 40 check (jar_spend between 0 and 100),
  jar_give    int not null default 20 check (jar_give between 0 and 100),
  allow_negative_balance boolean not null default false, -- see bills note below
  created_at  timestamptz not null default now(),
  constraint jars_sum_100 check (jar_save + jar_spend + jar_give = 100)
);

create table chores (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  name        text not null,
  icon        text not null default '⭐',
  value_pence int not null check (value_pence > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Recurring simulated household bills, set by a parent per child.
-- e.g. "Rent 80p", "Electricity 10p", "Food 30p", deducted weekly
-- from that child's balance regardless of which jar it's "in" —
-- real bills don't care whether the money was earmarked for saving.
create table bills (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  child_id    uuid not null references children(id) on delete cascade,
  name        text not null,
  icon        text not null default '🧾',
  amount_pence int not null check (amount_pence > 0),
  frequency   text not null default 'weekly' check (frequency in ('weekly', 'monthly')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- One row per time bills were actually run for a child, so "pay day"
-- can never double-charge the same week and the child/parent can see
-- a history of bill runs (paid in full vs. shortfall).
create table bill_runs (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  child_id      uuid not null references children(id) on delete cascade,
  run_at        timestamptz not null default now(),
  total_due_pence  int not null,
  total_paid_pence int not null,
  shortfall_pence  int not null default 0
);

create table chore_claims (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade, -- denormalised for simple RLS
  chore_id     uuid not null references chores(id) on delete cascade,
  child_id     uuid not null references children(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  claimed_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references parents(id)
);

-- Append-only ledger. A child's balance is the sum of their transactions,
-- never a mutable counter — this gives you a full audit trail for free.
create table transactions (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  child_id       uuid not null references children(id) on delete cascade,
  chore_claim_id uuid references chore_claims(id) on delete set null,
  bill_run_id    uuid references bill_runs(id) on delete set null,
  jar            text not null check (jar in ('save', 'spend', 'give', 'bills')),
  amount_pence   int not null, -- bill deductions are negative
  note           text,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- BALANCE VIEW  (derived, so it can never drift from the ledger)
-- ------------------------------------------------------------

create view child_balances as
select
  c.id as child_id,
  c.family_id,
  c.name,
  coalesce(sum(t.amount_pence) filter (where t.jar = 'save'), 0)  as save_pence,
  coalesce(sum(t.amount_pence) filter (where t.jar = 'spend'), 0) as spend_pence,
  coalesce(sum(t.amount_pence) filter (where t.jar = 'give'), 0)  as give_pence,
  coalesce(sum(t.amount_pence) filter (where t.jar = 'bills'), 0) as bills_pence, -- negative running total
  coalesce(sum(t.amount_pence), 0) as total_pence
from children c
left join transactions t on t.child_id = c.id
group by c.id, c.family_id, c.name;

-- ------------------------------------------------------------
-- HELPER FUNCTION — the family the current logged-in parent belongs to
-- ------------------------------------------------------------

create function my_family_id()
returns uuid
language sql
security definer
stable
as $$
  select family_id from parents where user_id = auth.uid() limit 1;
$$;

-- ------------------------------------------------------------
-- AUTO-CREATE PARENT ROW WHEN A NEW FAMILY IS CREATED
-- Call via rpc('create_family', { family_name: '...' }) from the app —
-- this avoids a race where a family exists with no owner yet.
-- ------------------------------------------------------------

create function create_family(family_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  new_family_id uuid;
begin
  if exists (select 1 from parents where user_id = auth.uid()) then
    raise exception 'This account already belongs to a family.';
  end if;

  insert into families (name, trial_ends_at) values (family_name, now() + interval '14 days') returning id into new_family_id;
  insert into parents (family_id, user_id, role) values (new_family_id, auth.uid(), 'owner');

  return new_family_id;
end;
$$;

-- ------------------------------------------------------------
-- CHILD PIN CHECK
-- Verifies a child's PIN server-side so the value itself is never selected
-- back to the client (the `children` table select list in the app
-- deliberately omits `pin` — see src/lib/api/children.js).
-- ------------------------------------------------------------

create function check_child_pin(target_child_id uuid, candidate_pin text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from children
    where id = target_child_id
      and family_id = my_family_id()
      and pin = candidate_pin
  );
$$;

revoke execute on function check_child_pin(uuid, text) from public;
revoke execute on function check_child_pin(uuid, text) from anon;

-- ------------------------------------------------------------
-- ACCOUNT / FAMILY DELETION
-- Cascades through every table that references families(id) on delete
-- cascade (children, chores, bills, bill_runs, chore_claims, transactions,
-- family_invites) in one statement. Restricted to the family's owner, not
-- any co-parent, since this is irreversible for the whole household.
-- Does not remove the caller's auth.users row — see the delete-account
-- edge function for that (a client can't delete its own auth user).
-- ------------------------------------------------------------

create function delete_my_family()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fam_id uuid;
  caller_role text;
begin
  fam_id := my_family_id();
  if fam_id is null then
    raise exception 'You do not belong to a family.';
  end if;

  select role into caller_role from parents where user_id = auth.uid();
  if caller_role <> 'owner' then
    raise exception 'Only the family owner can delete the family.';
  end if;

  delete from families where id = fam_id;
end;
$$;

revoke execute on function delete_my_family() from public;
revoke execute on function delete_my_family() from anon;

-- ------------------------------------------------------------
-- CO-PARENT INVITES
-- Short-lived, single-use codes — knowing a family's raw UUID is never
-- enough on its own to join it.
-- ------------------------------------------------------------

create table family_invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  code        text not null unique,
  created_by  uuid not null references parents(id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     uuid references parents(id),
  created_at  timestamptz not null default now()
);

alter table family_invites enable row level security;

create policy "select own family invites" on family_invites
  for select using (family_id = my_family_id());
-- no insert/update/delete policy: invites are only created/redeemed
-- through the security-definer functions below.

-- Generates a 6-character code (ambiguous characters 0/O, 1/I removed)
-- valid for 24 hours, and stores it against the caller's family.
create function create_family_invite()
returns family_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  fam_id uuid;
  my_parent_id uuid;
  new_code text;
  new_invite family_invites;
begin
  fam_id := my_family_id();
  if fam_id is null then
    raise exception 'You must belong to a family to invite a co-parent.';
  end if;

  select id into my_parent_id from parents where user_id = auth.uid();

  loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
      into new_code
      from generate_series(1, 6);
    exit when not exists (
      select 1 from family_invites where code = new_code and used_at is null and expires_at > now()
    );
  end loop;

  insert into family_invites (family_id, code, created_by, expires_at)
  values (fam_id, new_code, my_parent_id, now() + interval '24 hours')
  returning * into new_invite;

  return new_invite;
end;
$$;

-- Redeems an invite code: only valid while unused and unexpired, and only
-- for an account that doesn't already belong to a family.
create function redeem_family_invite(invite_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
  new_parent_id uuid;
begin
  if exists (select 1 from parents where user_id = auth.uid()) then
    raise exception 'This account already belongs to a family.';
  end if;

  select * into invite from family_invites
    where code = upper(trim(invite_code)) and used_at is null and expires_at > now()
    for update;

  if invite is null then
    raise exception 'That invite code is invalid or has expired.';
  end if;

  insert into parents (family_id, user_id, role) values (invite.family_id, auth.uid(), 'co_parent')
    returning id into new_parent_id;

  update family_invites set used_at = now(), used_by = new_parent_id where id = invite.id;
end;
$$;

-- Both functions are SECURITY DEFINER but only need to run for signed-in
-- parents, so the default PUBLIC/anon execute grants are revoked —
-- matching the rest of this schema's functions, which never had them.
revoke execute on function create_family_invite() from public;
revoke execute on function create_family_invite() from anon;
revoke execute on function redeem_family_invite(text) from public;
revoke execute on function redeem_family_invite(text) from anon;

-- Approve or decline a claim; only writes a transaction (and thus moves
-- money) when approving. Keeps the "money only moves on approval" rule
-- enforced in the database, not just the UI.
create function decide_chore_claim(claim_id uuid, approve boolean)
returns void
language plpgsql
security definer
as $$
declare
  claim record;
  child record;
  deciding_parent_id uuid;
begin
  select * into claim from chore_claims where id = claim_id and family_id = my_family_id();
  if claim is null then
    raise exception 'Claim not found in your family.';
  end if;
  if claim.status <> 'pending' then
    raise exception 'This claim has already been decided.';
  end if;

  select id into deciding_parent_id from parents where user_id = auth.uid();

  update chore_claims
    set status = case when approve then 'approved' else 'declined' end,
        decided_at = now(),
        decided_by = deciding_parent_id
    where id = claim_id;

  if approve then
    select c.*, ch.value_pence into child
      from children c
      join chores ch on ch.id = claim.chore_id
      where c.id = claim.child_id;

    insert into transactions (family_id, child_id, chore_claim_id, jar, amount_pence, note)
    values
      (claim.family_id, claim.child_id, claim.id, 'save',  round(child.value_pence * child.jar_save  / 100.0), 'Chore reward'),
      (claim.family_id, claim.child_id, claim.id, 'spend', round(child.value_pence * child.jar_spend / 100.0), 'Chore reward'),
      (claim.family_id, claim.child_id, claim.id, 'give',  child.value_pence
        - round(child.value_pence * child.jar_save  / 100.0)
        - round(child.value_pence * child.jar_spend / 100.0), 'Chore reward');
    -- give jar takes the rounding remainder so the three always sum exactly to value_pence
  end if;
end;
$$;

-- "Pay day" — charges every active bill for one child in a single run.
-- Deducts from total balance, not any one jar. If the child's balance
-- can't cover everything and allow_negative_balance is false (the
-- default), it pays what it can in the order bills were created and
-- records the rest as a shortfall rather than driving them into debt —
-- a gentler lesson for younger kids. Set allow_negative_balance = true
-- on a child for the sharper real-world version.
create function run_bills_for_child(target_child_id uuid)
returns bill_runs
language plpgsql
security definer
as $$
declare
  kid record;
  bill record;
  available int;
  total_due int := 0;
  total_paid int := 0;
  to_pay int;
  new_run bill_runs;
begin
  select * into kid from children where id = target_child_id and family_id = my_family_id();
  if kid is null then
    raise exception 'Child not found in your family.';
  end if;

  select coalesce(sum(amount_pence), 0) into available from transactions where child_id = target_child_id;

  insert into bill_runs (family_id, child_id, total_due_pence, total_paid_pence, shortfall_pence)
  values (kid.family_id, target_child_id, 0, 0, 0)
  returning * into new_run;

  for bill in
    select * from bills
    where child_id = target_child_id and active = true
    order by created_at
  loop
    total_due := total_due + bill.amount_pence;

    if kid.allow_negative_balance then
      to_pay := bill.amount_pence;
    else
      to_pay := least(bill.amount_pence, greatest(available, 0));
    end if;

    if to_pay > 0 then
      insert into transactions (family_id, child_id, bill_run_id, jar, amount_pence, note)
      values (kid.family_id, target_child_id, new_run.id, 'bills', -to_pay, bill.name);
      total_paid := total_paid + to_pay;
      available := available - to_pay;
    end if;
  end loop;

  update bill_runs
    set total_due_pence = total_due,
        total_paid_pence = total_paid,
        shortfall_pence = total_due - total_paid
    where id = new_run.id
    returning * into new_run;

  return new_run;
end;
$$;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table families      enable row level security;
alter table parents       enable row level security;
alter table children      enable row level security;
alter table chores        enable row level security;
alter table chore_claims  enable row level security;
alter table transactions  enable row level security;
alter table bills         enable row level security;
alter table bill_runs     enable row level security;

-- families: a parent can see/update only their own family
create policy "select own family" on families
  for select using (id = my_family_id());
create policy "update own family" on families
  for update using (id = my_family_id());
-- insert happens only via the create_family() function (security definer)

-- Column-level lockdown: RLS above only governs which ROWS a parent can
-- update, not which COLUMNS — without this, any parent could set their own
-- subscription_status via a crafted request. Billing columns are written
-- only by the stripe-webhook edge function (service role, bypasses RLS and
-- these grants entirely) and trial_ends_at once by create_family().
revoke update on families from authenticated;
grant update (name, currency) on families to authenticated;

-- parents: see co-parents in your own family
create policy "select family parents" on parents
  for select using (family_id = my_family_id());

-- children: full CRUD for parents within their family
create policy "select own children" on children
  for select using (family_id = my_family_id());
create policy "insert own children" on children
  for insert with check (family_id = my_family_id());
create policy "update own children" on children
  for update using (family_id = my_family_id());
create policy "delete own children" on children
  for delete using (family_id = my_family_id());

-- chores: full CRUD for parents within their family
create policy "select own chores" on chores
  for select using (family_id = my_family_id());
create policy "insert own chores" on chores
  for insert with check (family_id = my_family_id());
create policy "update own chores" on chores
  for update using (family_id = my_family_id());
create policy "delete own chores" on chores
  for delete using (family_id = my_family_id());

-- chore_claims: parents (acting for the household device) can view and
-- create claims; approval/decline goes through decide_chore_claim() only
create policy "select own claims" on chore_claims
  for select using (family_id = my_family_id());
create policy "insert own claims" on chore_claims
  for insert with check (family_id = my_family_id());
-- no direct update policy — status changes only via decide_chore_claim()

-- transactions: read-only from the client; all writes go through
-- decide_chore_claim() / run_bills_for_child() (both security definer),
-- so no insert/update policy needed
create policy "select own transactions" on transactions
  for select using (family_id = my_family_id());

-- bills: full CRUD for parents within their family
create policy "select own bills" on bills
  for select using (family_id = my_family_id());
create policy "insert own bills" on bills
  for insert with check (family_id = my_family_id());
create policy "update own bills" on bills
  for update using (family_id = my_family_id());
create policy "delete own bills" on bills
  for delete using (family_id = my_family_id());

-- bill_runs: read-only from the client; written only by run_bills_for_child()
create policy "select own bill runs" on bill_runs
  for select using (family_id = my_family_id());

-- balance view inherits RLS from its underlying tables automatically
-- when queried through PostgREST with the user's JWT.

-- ============================================================
-- DESIGN NOTE — why children aren't separate auth.users
-- ============================================================
-- Kids under 12 shouldn't hold independent accounts with their own
-- credentials and data-controller relationship to your app — it's a
-- heavier privacy/consent burden (UK GDPR / children's data) than the
-- product needs. Instead, one parent authenticates on the household
-- device, and "child mode" is a UI-level view within that same
-- authenticated session, gated by a 4-digit PIN stored per child.
-- That PIN is a convenience lock, not a security boundary — anyone
-- with the parent's device is already inside the RLS boundary.
-- If you outgrow this (e.g. kids want their own phone login), the
-- next step is Supabase Auth "anonymous" users linked to a child_id,
-- promoted to a real account at a chosen age.

-- ============================================================
-- DESIGN NOTE — automating "pay day"
-- ============================================================
-- run_bills_for_child() is written so the app can call it on demand
-- (a "Pay day!" button parents/kids tap together), which is enough to
-- prove the concept. To make bills charge automatically every Monday
-- with nobody needing to open the app:
--   1. Enable the pg_cron extension (Database → Extensions).
--   2. Schedule a weekly job that loops over children and calls
--      run_bills_for_child(id) for each — wrap that loop in one more
--      security-definer function (e.g. run_all_bills()) so cron only
--      needs to call one thing.
-- Worth doing once the manual button has been tested with real bills
-- for a week or two.

-- ============================================================
-- CHILD PERSONALISATION
-- `theme` holds { color, icon, wallpaper } chosen on the child's screen;
-- `avatar_url` is a Storage object path in the private `avatars` bucket,
-- laid out as <family_id>/<child_id>.jpg so the policies below can scope
-- access to the owning family by folder. Photos are read via short-lived
-- signed URLs — never public.
-- ============================================================

alter table children add column theme jsonb not null default '{}'::jsonb;
alter table children add column avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "family reads own avatars" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_family_id()::text);

create policy "family uploads own avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_family_id()::text);

create policy "family replaces own avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_family_id()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_family_id()::text);

-- ============================================================
-- WEEKLY POCKET MONEY, PER-CHILD CHORES, PUSH ALERTS
-- See supabase/migrations/20261016_weekly_budget_and_push.sql for the
-- rationale on each piece; this block is the fresh-project equivalent.
-- ============================================================

alter table children add column weekly_budget_pence int not null default 0 check (weekly_budget_pence >= 0);
alter table children add column birth_year smallint check (birth_year is null or birth_year between 1990 and 2100);

alter table chores add column child_id uuid references children(id) on delete cascade;
alter table chores add column times_per_week int not null default 1 check (times_per_week between 1 and 14);
alter table chores add column custom_value boolean not null default false;
create index chores_child_id_idx on chores(child_id);
create index chore_claims_week_idx on chore_claims(chore_id, child_id, claimed_at);

-- Spreads a child's weekly budget evenly over every completion of their
-- auto-valued chores, after taking custom-valued ones off the top. Auto
-- chores are worth at least 1p (value_pence must stay > 0) until a budget
-- covers them; the UI flags that state.
create function rebalance_child_chores(target_child_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  budget int;
  custom_total int;
  auto_slots int;
  per int;
begin
  select weekly_budget_pence into budget from children where id = target_child_id;
  if budget is null then return; end if;
  select coalesce(sum(value_pence * times_per_week), 0) into custom_total
    from chores where child_id = target_child_id and active and custom_value;
  select coalesce(sum(times_per_week), 0) into auto_slots
    from chores where child_id = target_child_id and active and not custom_value;
  per := case when auto_slots > 0 then greatest((budget - custom_total) / auto_slots, 1) else 1 end;
  update chores set value_pence = per
    where child_id = target_child_id and active and not custom_value and value_pence is distinct from per;
end;
$$;

create function chores_rebalance_trg()
returns trigger
language plpgsql
as $$
declare
  cid uuid;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  cid := case when tg_op = 'INSERT' then new.child_id else coalesce(new.child_id, old.child_id) end;
  if cid is not null then perform rebalance_child_chores(cid); end if;
  return null;
end;
$$;

create trigger chores_rebalance
  after insert or update on chores
  for each row execute function chores_rebalance_trg();

create function children_budget_trg()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  perform rebalance_child_chores(new.id);
  return null;
end;
$$;

create trigger children_budget_rebalance
  after update of weekly_budget_pence on children
  for each row execute function children_budget_trg();

-- Claiming goes through one function so the weekly limit is enforced in
-- the database, not just hidden in the UI. Weeks start Monday 00:00 UTC.
create function claim_chore(target_chore_id uuid, target_child_id uuid)
returns chore_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  ch record;
  kid record;
  done int;
  new_claim chore_claims;
begin
  select * into ch from chores where id = target_chore_id and family_id = my_family_id() and active;
  if ch is null then raise exception 'Chore not found.'; end if;
  select * into kid from children where id = target_child_id and family_id = my_family_id();
  if kid is null then raise exception 'Child not found.'; end if;
  if ch.child_id is not null and ch.child_id <> kid.id then
    raise exception 'That chore belongs to someone else.';
  end if;
  select count(*) into done from chore_claims
    where chore_id = ch.id and child_id = kid.id
      and status in ('pending', 'approved')
      and claimed_at >= date_trunc('week', now());
  if done >= ch.times_per_week then
    raise exception 'That chore is already done for this week.';
  end if;
  insert into chore_claims (family_id, chore_id, child_id)
    values (ch.family_id, ch.id, kid.id)
    returning * into new_claim;
  return new_claim;
end;
$$;

revoke execute on function claim_chore(uuid, uuid) from public;
revoke execute on function claim_chore(uuid, uuid) from anon;

-- Direct inserts would bypass the weekly limit; claims only arrive via claim_chore().
alter policy "insert own claims" on chore_claims with check (false);

-- Web-push subscriptions for the parent's devices ("Ella finished a chore").
create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  keys        jsonb not null, -- { p256dh, auth } from PushSubscription.toJSON()
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "select own push subs" on push_subscriptions
  for select using (family_id = my_family_id());
create policy "insert own push subs" on push_subscriptions
  for insert with check (family_id = my_family_id() and user_id = auth.uid());
create policy "update own push subs" on push_subscriptions
  for update using (family_id = my_family_id());

-- ------------------------------------------------------------
-- CHILD DEVICES, ROLES & MESSAGES (migration 20261017)
-- ------------------------------------------------------------
-- Proper FKs here; the hosted migration omitted them to avoid the
-- "on delete cascade" token (see migration file notes).

-- Child devices (username + PIN sign-in via anonymous auth users), parent /
-- child messaging, and the permission split between the two roles.
--
-- Roles in this schema from here on:
--   parent  = auth user with a row in `parents`            (is_parent())
--   child   = anonymous auth user with a row in `child_devices` (my_child_id())
-- my_family_id() works for both.

-- ---------- children: login fields ----------

alter table children add column if not exists username text;
alter table children add column if not exists failed_logins int not null default 0;
alter table children add column if not exists locked_until timestamptz;
create unique index if not exists children_username_unique on children (lower(username)) where username is not null;
alter table children add constraint children_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9_-]{2,19}$');

-- ---------- child devices ----------

create table child_devices (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  child_id      uuid not null references children(id) on delete cascade,
  user_id       uuid not null unique references auth.users(id) on delete cascade, -- the anonymous auth user that is this device
  label         text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  revoked_at    timestamptz
);
create index if not exists child_devices_child_idx on child_devices(child_id);
alter table child_devices enable row level security;

-- ---------- role helpers ----------

create or replace function is_parent()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from parents where user_id = auth.uid());
$$;

create or replace function my_child_id()
returns uuid language sql security definer stable set search_path = public as $$
  select child_id from child_devices where user_id = auth.uid() and revoked_at is null limit 1;
$$;

create or replace function my_family_id()
returns uuid language sql security definer stable as $$
  select coalesce(
    (select family_id from parents where user_id = auth.uid() limit 1),
    (select family_id from child_devices where user_id = auth.uid() and revoked_at is null limit 1)
  );
$$;

create or replace function is_anonymous_user()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- ---------- child device policies ----------

create policy "see own device or family devices" on child_devices
  for select using (user_id = auth.uid() or (is_parent() and family_id = my_family_id()));
create policy "parents manage devices" on child_devices
  for update using (is_parent() and family_id = my_family_id());

-- ---------- sign-in / device RPCs ----------

-- Called right after supabase.auth.signInAnonymously(): checks the username
-- and PIN (with a 5-strike, 15-minute lockout) and ties this anonymous user
-- to the child.
create or replace function link_child_device(login_username text, candidate_pin text, device_label text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  kid record;
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  if not is_anonymous_user() then raise exception 'Use a child sign-in for a child device.'; end if;

  perform set_config('pocket.bypass_guard', 'on', true);

  select * into kid from children where lower(username) = lower(trim(login_username));
  if kid is null then raise exception 'We couldn''t find that username.'; end if;
  if kid.locked_until is not null and kid.locked_until > now() then
    raise exception 'Too many tries — ask a grown-up and try again in a few minutes.';
  end if;
  if kid.pin <> candidate_pin then
    update children
      set failed_logins = failed_logins + 1,
          locked_until = case when failed_logins + 1 >= 5 then now() + interval '15 minutes' else null end
      where id = kid.id;
    raise exception 'That PIN isn''t right.';
  end if;

  update children set failed_logins = 0, locked_until = null where id = kid.id;

  insert into child_devices (family_id, child_id, user_id, label)
    values (kid.family_id, kid.id, auth.uid(), device_label)
    on conflict (user_id) do update
      set child_id = excluded.child_id, family_id = excluded.family_id,
          label = excluded.label, revoked_at = null, last_seen_at = now();

  return json_build_object('child_id', kid.id, 'family_id', kid.family_id, 'name', kid.name);
end;
$$;

create or replace function touch_child_device()
returns void language sql security definer set search_path = public as $$
  update child_devices set last_seen_at = now() where user_id = auth.uid();
$$;

-- Child signs out of this device.
create or replace function unlink_this_device()
returns void language sql security definer set search_path = public as $$
  update child_devices set revoked_at = now() where user_id = auth.uid();
$$;

-- Parents can read a child's PIN back (e.g. when it's forgotten).
create or replace function reveal_child_pin(target_child_id uuid)
returns text language sql security definer set search_path = public as $$
  select pin from children where id = target_child_id and family_id = my_family_id() and is_parent();
$$;

revoke execute on function link_child_device(text, text, text) from public, anon;
revoke execute on function touch_child_device() from public, anon;
revoke execute on function unlink_this_device() from public, anon;
revoke execute on function reveal_child_pin(uuid) from public, anon;

-- ---------- guards: what a child device may change ----------

-- A child may only change their own theme / avatar. Everything else on their
-- row is parent-only. Security-definer RPCs that legitimately touch other
-- columns (link_child_device) set pocket.bypass_guard first.
create or replace function children_update_guard()
returns trigger language plpgsql as $$
begin
  if current_setting('pocket.bypass_guard', true) = 'on' or is_parent() then return new; end if;
  if new.id is distinct from my_child_id() then raise exception 'Not allowed.'; end if;
  if new.name is distinct from old.name or new.pin is distinct from old.pin
     or new.username is distinct from old.username or new.birth_year is distinct from old.birth_year
     or new.weekly_budget_pence is distinct from old.weekly_budget_pence
     or new.jar_save is distinct from old.jar_save or new.jar_spend is distinct from old.jar_spend
     or new.jar_give is distinct from old.jar_give or new.allow_negative_balance is distinct from old.allow_negative_balance
     or new.family_id is distinct from old.family_id or new.failed_logins is distinct from old.failed_logins
     or new.locked_until is distinct from old.locked_until then
    raise exception 'Only a parent can change that.';
  end if;
  return new;
end;
$$;
create or replace trigger children_update_guard before update on children
  for each row execute function children_update_guard();

create or replace function parent_only_guard()
returns trigger language plpgsql as $$
begin
  if current_setting('pocket.bypass_guard', true) = 'on' or is_parent() then return coalesce(new, old); end if;
  raise exception 'Only a parent can do that.';
end;
$$;

-- ---------- tighten existing policies ----------

alter policy "select own children" on children using (family_id = my_family_id() and (is_parent() or id = my_child_id()));
alter policy "insert own children" on children with check (family_id = my_family_id() and is_parent());
alter policy "update own children" on children using (family_id = my_family_id() and (is_parent() or id = my_child_id()));

alter policy "select own chores" on chores using (family_id = my_family_id() and (is_parent() or child_id is null or child_id = my_child_id()));
alter policy "insert own chores" on chores with check (family_id = my_family_id() and is_parent());
alter policy "update own chores" on chores using (family_id = my_family_id() and is_parent());

alter policy "select own claims" on chore_claims using (family_id = my_family_id() and (is_parent() or child_id = my_child_id()));
alter policy "select own transactions" on transactions using (family_id = my_family_id() and (is_parent() or child_id = my_child_id()));

alter policy "select own bills" on bills using (family_id = my_family_id() and (is_parent() or child_id = my_child_id()));
alter policy "insert own bills" on bills with check (family_id = my_family_id() and is_parent());
alter policy "update own bills" on bills using (family_id = my_family_id() and is_parent());
alter policy "select own bill runs" on bill_runs using (family_id = my_family_id() and (is_parent() or child_id = my_child_id()));

alter policy "select family parents" on parents using (family_id = my_family_id() and is_parent());
alter policy "select own family invites" on family_invites using (family_id = my_family_id() and is_parent());
alter policy "update own family" on families using (id = my_family_id() and is_parent());

alter policy "family reads own avatars" on storage.objects
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_family_id()::text
         and (public.is_parent() or name = public.my_family_id()::text || '/' || public.my_child_id()::text || '.jpg'));
alter policy "family uploads own avatars" on storage.objects
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_family_id()::text
         and (public.is_parent() or name = public.my_family_id()::text || '/' || public.my_child_id()::text || '.jpg'));
alter policy "family replaces own avatars" on storage.objects
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_family_id()::text
         and (public.is_parent() or name = public.my_family_id()::text || '/' || public.my_child_id()::text || '.jpg'))
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_family_id()::text
         and (public.is_parent() or name = public.my_family_id()::text || '/' || public.my_child_id()::text || '.jpg'));

-- ---------- RPCs that must be parent-only or child-scoped ----------

create or replace function decide_chore_claim(claim_id uuid, approve boolean)
returns void
language plpgsql
security definer
as $$
declare
  claim record;
  child record;
  deciding_parent_id uuid;
begin
  if not is_parent() then raise exception 'Only a parent can approve chores.'; end if;

  select * into claim from chore_claims where id = claim_id and family_id = my_family_id();
  if claim is null then raise exception 'Claim not found in your family.'; end if;
  if claim.status <> 'pending' then raise exception 'This claim has already been decided.'; end if;

  select id into deciding_parent_id from parents where user_id = auth.uid();

  update chore_claims
    set status = case when approve then 'approved' else 'declined' end,
        decided_at = now(),
        decided_by = deciding_parent_id
    where id = claim_id;

  if approve then
    select c.*, ch.value_pence into child
      from children c
      join chores ch on ch.id = claim.chore_id
      where c.id = claim.child_id;

    insert into transactions (family_id, child_id, chore_claim_id, jar, amount_pence, note)
    values
      (claim.family_id, claim.child_id, claim.id, 'save',  round(child.value_pence * child.jar_save  / 100.0), 'Chore reward'),
      (claim.family_id, claim.child_id, claim.id, 'spend', round(child.value_pence * child.jar_spend / 100.0), 'Chore reward'),
      (claim.family_id, claim.child_id, claim.id, 'give',  child.value_pence
        - round(child.value_pence * child.jar_save  / 100.0)
        - round(child.value_pence * child.jar_spend / 100.0), 'Chore reward');
  end if;
end;
$$;

create or replace function claim_chore(target_chore_id uuid, target_child_id uuid)
returns chore_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  ch record;
  kid record;
  done int;
  new_claim chore_claims;
begin
  select * into ch from chores where id = target_chore_id and family_id = my_family_id() and active;
  if ch is null then raise exception 'Chore not found.'; end if;

  select * into kid from children where id = target_child_id and family_id = my_family_id();
  if kid is null then raise exception 'Child not found.'; end if;

  if not is_parent() and kid.id is distinct from my_child_id() then
    raise exception 'You can only mark your own chores.';
  end if;
  if ch.child_id is not null and ch.child_id <> kid.id then
    raise exception 'That chore belongs to someone else.';
  end if;

  select count(*) into done from chore_claims
    where chore_id = ch.id and child_id = kid.id
      and status in ('pending', 'approved')
      and claimed_at >= date_trunc('week', now());
  if done >= ch.times_per_week then
    raise exception 'That chore is already done for this week.';
  end if;

  insert into chore_claims (family_id, chore_id, child_id)
    values (ch.family_id, ch.id, kid.id)
    returning * into new_claim;
  return new_claim;
end;
$$;

create or replace function check_child_pin(target_child_id uuid, candidate_pin text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from children
    where id = target_child_id and family_id = my_family_id() and is_parent() and pin = candidate_pin
  );
$$;

-- Anonymous (child) users must never become parents.
create or replace function create_family(family_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  new_family_id uuid;
begin
  if is_anonymous_user() then raise exception 'Sign in as a parent to create a family.'; end if;
  if exists (select 1 from parents where user_id = auth.uid()) then
    raise exception 'This account already belongs to a family.';
  end if;
  insert into families (name, trial_ends_at) values (family_name, now() + interval '14 days') returning id into new_family_id;
  insert into parents (family_id, user_id, role) values (new_family_id, auth.uid(), 'owner');
  return new_family_id;
end;
$$;

create or replace function redeem_family_invite(invite_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
  new_parent_id uuid;
begin
  if is_anonymous_user() then raise exception 'Sign in as a parent to join a family.'; end if;
  if exists (select 1 from parents where user_id = auth.uid()) then
    raise exception 'This account already belongs to a family.';
  end if;
  select * into invite from family_invites
    where code = upper(trim(invite_code)) and used_at is null and expires_at > now()
    for update;
  if invite is null then raise exception 'That invite code is invalid or has expired.'; end if;
  insert into parents (family_id, user_id, role) values (invite.family_id, auth.uid(), 'co_parent')
    returning id into new_parent_id;
  update family_invites set used_at = now(), used_by = new_parent_id where id = invite.id;
end;
$$;

-- ---------- messages ----------

create table messages (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id) on delete cascade,
  child_id        uuid not null references children(id) on delete cascade,
  sender          text not null check (sender in ('parent', 'child')),
  sender_user_id  uuid not null,
  body            text not null check (char_length(body) between 1 and 500),
  kind            text not null default 'text' check (kind in ('text', 'quick')),
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);
create index if not exists messages_child_idx on messages(child_id, created_at desc);
alter table messages enable row level security;

create policy "see family messages" on messages
  for select using (family_id = my_family_id() and (is_parent() or child_id = my_child_id()));
create policy "send messages" on messages
  for insert with check (
    family_id = my_family_id() and sender_user_id = auth.uid()
    and ((is_parent() and sender = 'parent') or (child_id = my_child_id() and sender = 'child'))
  );
create policy "mark messages read" on messages
  for update using (family_id = my_family_id() and (is_parent() or child_id = my_child_id()));

-- Only read_at may change after a message is sent.
create or replace function messages_update_guard()
returns trigger language plpgsql as $$
begin
  if new.body is distinct from old.body or new.sender is distinct from old.sender
     or new.child_id is distinct from old.child_id or new.family_id is distinct from old.family_id
     or new.kind is distinct from old.kind or new.sender_user_id is distinct from old.sender_user_id then
    raise exception 'Messages cannot be edited.';
  end if;
  return new;
end;
$$;
create or replace trigger messages_update_guard before update on messages
  for each row execute function messages_update_guard();

-- The realtime publication existed but was empty, so the parent dashboard's
-- live refresh on chore_claims never actually fired. Both tables now publish.
alter publication supabase_realtime add table messages, chore_claims;

-- The balance view must respect the caller's row access (a child device may
-- only see its own child's rows).
alter view child_balances set (security_invoker = true);

-- Pay day is a parent action: same body as before plus the is_parent() check.
create or replace function run_bills_for_child(target_child_id uuid)
returns bill_runs
language plpgsql
security definer
as $$
declare
  kid record;
  bill record;
  available int;
  total_due int := 0;
  total_paid int := 0;
  to_pay int;
  new_run bill_runs;
begin
  if not is_parent() then raise exception 'Only a parent can run pay day.'; end if;

  select * into kid from children where id = target_child_id and family_id = my_family_id();
  if kid is null then
    raise exception 'Child not found in your family.';
  end if;

  select coalesce(sum(amount_pence), 0) into available from transactions where child_id = target_child_id;

  insert into bill_runs (family_id, child_id, total_due_pence, total_paid_pence, shortfall_pence)
  values (kid.family_id, target_child_id, 0, 0, 0)
  returning * into new_run;

  for bill in
    select * from bills
    where child_id = target_child_id and active = true
    order by created_at
  loop
    total_due := total_due + bill.amount_pence;

    if kid.allow_negative_balance then
      to_pay := bill.amount_pence;
    else
      to_pay := least(bill.amount_pence, greatest(available, 0));
    end if;

    if to_pay > 0 then
      insert into transactions (family_id, child_id, bill_run_id, jar, amount_pence, note)
      values (kid.family_id, target_child_id, new_run.id, 'bills', -to_pay, bill.name);
      total_paid := total_paid + to_pay;
      available := available - to_pay;
    end if;
  end loop;

  update bill_runs
    set total_due_pence = total_due,
        total_paid_pence = total_paid,
        shortfall_pence = total_due - total_paid
    where id = new_run.id
    returning * into new_run;

  return new_run;
end;
$$;

-- ---------- push: who a subscription belongs to ----------

alter table push_subscriptions add column if not exists audience text not null default 'parent';
alter table push_subscriptions add column if not exists child_id uuid references children(id) on delete cascade;
alter policy "insert own push subs" on push_subscriptions
  with check (
    family_id = my_family_id() and user_id = auth.uid()
    and ((is_parent() and audience = 'parent') or (audience = 'child' and child_id = my_child_id()))
  );
alter policy "select own push subs" on push_subscriptions
  using (user_id = auth.uid() or (is_parent() and family_id = my_family_id()));
alter policy "update own push subs" on push_subscriptions
  using (user_id = auth.uid() or (is_parent() and family_id = my_family_id()));


-- Row-removal guards (a child device must never remove family rows).
create trigger children_parent_only_del before delete on children for each row execute function parent_only_guard();
create trigger chores_parent_only_del   before delete on chores   for each row execute function parent_only_guard();
create trigger bills_parent_only_del    before delete on bills    for each row execute function parent_only_guard();
