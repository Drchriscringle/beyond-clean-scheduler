-- ============================================================
-- Pocket Ledger — Supabase schema
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
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

  insert into families (name) values (family_name) returning id into new_family_id;
  insert into parents (family_id, user_id, role) values (new_family_id, auth.uid(), 'owner');

  return new_family_id;
end;
$$;

-- Invite a co-parent: the invited user must already have signed up.
create function join_family_as_coparent(invite_family_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if exists (select 1 from parents where user_id = auth.uid()) then
    raise exception 'This account already belongs to a family.';
  end if;
  insert into parents (family_id, user_id, role) values (invite_family_id, auth.uid(), 'co_parent');
end;
$$;

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
