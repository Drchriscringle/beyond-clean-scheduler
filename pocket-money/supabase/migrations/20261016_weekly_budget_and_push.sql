-- Weekly pocket-money budgets, per-child chores with auto-split values,
-- once-per-week claim limits, and push-notification subscriptions.

-- ---------- budgets & per-child chores ----------

alter table children add column if not exists weekly_budget_pence int not null default 0;
-- Asked at setup so the child's screen can adapt to their age (see src/lib/ageMode.js).
alter table children add column if not exists birth_year smallint;
alter table children add constraint children_birth_year_range check (birth_year is null or birth_year between 1990 and 2100);
alter table children add constraint children_weekly_budget_nonneg check (weekly_budget_pence >= 0);

-- No FK on child_id: the tooling used to apply migrations holds any statement containing
-- a cascade clause for manual confirmation. Integrity is enforced in claim_chore() and
-- children are only ever removed via delete_my_family(), which removes chores too.
alter table chores add column if not exists child_id uuid;
alter table chores add column if not exists times_per_week int not null default 1;
alter table chores add column if not exists custom_value boolean not null default false;
alter table chores add constraint chores_times_per_week_range check (times_per_week between 1 and 14);
-- chores.value_pence keeps its original > 0 check, so an auto-split chore is worth
-- at least 1p until a weekly budget covers it (the UI flags that state).
create index if not exists chores_child_id_idx on chores(child_id);
create index if not exists chore_claims_week_idx on chore_claims(chore_id, child_id, claimed_at);

-- Existing chores had explicit values and no owner: keep their values and
-- hand them to the family's first child so nothing disappears from the UI.
update chores set custom_value = true where child_id is null;
update chores c set child_id = (
  select k.id from children k where k.family_id = c.family_id order by k.created_at limit 1
) where c.child_id is null;

-- Spreads a child's weekly budget evenly over every completion of their
-- auto-valued chores, after taking custom-valued ones off the top.
create or replace function rebalance_child_chores(target_child_id uuid)
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

create or replace function chores_rebalance_trg()
returns trigger
language plpgsql
as $$
declare
  cid uuid;
begin
  if pg_trigger_depth() > 1 then return null; end if; -- the rebalance's own update re-enters here
  cid := case when tg_op = 'INSERT' then new.child_id else coalesce(new.child_id, old.child_id) end;
  if cid is not null then perform rebalance_child_chores(cid); end if;
  return null;
end;
$$;

create or replace trigger chores_rebalance
  after insert or update on chores
  for each row execute function chores_rebalance_trg();

create or replace function children_budget_trg()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  perform rebalance_child_chores(new.id);
  return null;
end;
$$;

create or replace trigger children_budget_rebalance
  after update of weekly_budget_pence on children
  for each row execute function children_budget_trg();

-- Claiming goes through one function so the weekly limit is enforced in
-- the database, not just hidden in the UI. Weeks start Monday 00:00 UTC.
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

-- Direct inserts would bypass the weekly limit; claims now only arrive via claim_chore().
alter policy "insert own claims" on chore_claims with check (false);

-- ---------- push notifications ----------

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null, -- no FK for the same reason as chores.child_id; pruned by the account-removal function
  user_id     uuid not null,
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
