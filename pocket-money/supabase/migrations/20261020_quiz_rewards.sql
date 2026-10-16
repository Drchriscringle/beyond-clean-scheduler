-- Rewards for learning. A correct daily-quiz answer and correct answers in
-- the money games earn either pocket money (into the jars, like a chore) or
-- points the child saves up and trades for rewards the parent has set up
-- ("a cuddle", "cinema trip"). The parent picks the mode and amount per child.

alter table children add column if not exists quiz_reward_mode text not null default 'points';
alter table children add column if not exists quiz_reward_pence int not null default 5;
alter table children add column if not exists quiz_points_per_correct int not null default 1;
alter table children add constraint children_quiz_reward_mode_check check (quiz_reward_mode in ('none', 'money', 'points'));
alter table children add constraint children_quiz_reward_pence_check check (quiz_reward_pence between 0 and 500);
alter table children add constraint children_quiz_points_check check (quiz_points_per_correct between 0 and 10);

-- Things points can be traded for. child_id null = any child in the family.
create table if not exists rewards (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null,
  child_id     uuid,
  name         text not null check (char_length(name) between 1 and 60),
  icon         text not null default 'gift',
  cost_points  int not null check (cost_points between 1 and 10000),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table rewards enable row level security;
create policy "family sees rewards" on rewards
  for select using (family_id = my_family_id() and (is_parent() or child_id is null or child_id = my_child_id()));
create policy "parents add rewards" on rewards
  for insert with check (family_id = my_family_id() and is_parent());
create policy "parents edit rewards" on rewards
  for update using (family_id = my_family_id() and is_parent());

-- Every award, once per child per activity per day (the ref), so a quiz
-- can't be re-answered for more money.
create table if not exists learning_awards (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null,
  child_id      uuid not null,
  ref           text not null unique,
  kind          text not null,
  correct       int not null,
  mode          text not null,
  amount_pence  int not null default 0,
  points        int not null default 0,
  created_at    timestamptz not null default now()
);
alter table learning_awards enable row level security;
create policy "family sees awards" on learning_awards
  for select using (family_id = my_family_id() and (is_parent() or child_id = my_child_id()));

-- Points in and out. Balance = sum(delta).
create table if not exists points_ledger (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null,
  child_id    uuid not null,
  delta       int not null,
  reason      text not null,
  created_at  timestamptz not null default now()
);
alter table points_ledger enable row level security;
create policy "family sees points" on points_ledger
  for select using (family_id = my_family_id() and (is_parent() or child_id = my_child_id()));
create index if not exists points_ledger_child_idx on points_ledger(child_id, created_at desc);

create or replace view child_points with (security_invoker = true) as
  select child_id, family_id, coalesce(sum(delta), 0)::int as points
  from points_ledger group by child_id, family_id;

-- A child asks for a reward; points are held straight away and refunded
-- if the parent declines.
create table if not exists reward_requests (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null,
  child_id     uuid not null,
  reward_id    uuid not null,
  reward_name  text not null,
  reward_icon  text not null default 'gift',
  cost_points  int not null,
  status       text not null default 'requested' check (status in ('requested', 'granted', 'declined')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
alter table reward_requests enable row level security;
create policy "family sees reward requests" on reward_requests
  for select using (family_id = my_family_id() and (is_parent() or child_id = my_child_id()));

-- ---------- RPCs ----------

-- Called after a quiz answer or a finished game. `kind` is 'quiz' or
-- 'game:<key>'; `day_key` is the device's local date; `correct` how many
-- answers were right. Pays by the child's reward mode. Idempotent per
-- child/kind/day. A parent previewing a child's screen awards that child.
create or replace function award_learning(target_child_id uuid, kind text, day_key text, correct int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  kid record;
  ref text;
  n int := greatest(0, least(coalesce(correct, 0), 10));
  amount int := 0;
  pts int := 0;
  d date;
begin
  if kind not in ('quiz', 'game:needwant', 'game:coins', 'game:jars', 'game:value') then
    raise exception 'Unknown activity.';
  end if;
  begin
    d := day_key::date;
  exception when others then
    d := current_date;
  end;
  if d < current_date - 1 or d > current_date + 1 then d := current_date; end if;

  select * into kid from children where id = target_child_id and family_id = my_family_id();
  if kid is null then raise exception 'Child not found.'; end if;
  if not is_parent() and kid.id is distinct from my_child_id() then raise exception 'Not allowed.'; end if;

  ref := kid.id::text || ':' || kind || ':' || d::text;
  if exists (select 1 from learning_awards where learning_awards.ref = award_learning.ref) then
    return json_build_object('mode', kid.quiz_reward_mode, 'amount_pence', 0, 'points', 0, 'already', true);
  end if;

  if n > 0 and kid.quiz_reward_mode = 'money' then
    amount := kid.quiz_reward_pence * n;
  elsif n > 0 and kid.quiz_reward_mode = 'points' then
    pts := kid.quiz_points_per_correct * n;
  end if;

  insert into learning_awards (family_id, child_id, ref, kind, correct, mode, amount_pence, points)
    values (kid.family_id, kid.id, ref, kind, n, kid.quiz_reward_mode, amount, pts);

  if amount > 0 then
    insert into transactions (family_id, child_id, jar, amount_pence, note)
    values
      (kid.family_id, kid.id, 'save',  round(amount * kid.jar_save  / 100.0), case when kind = 'quiz' then 'Quiz reward' else 'Game reward' end),
      (kid.family_id, kid.id, 'spend', round(amount * kid.jar_spend / 100.0), case when kind = 'quiz' then 'Quiz reward' else 'Game reward' end),
      (kid.family_id, kid.id, 'give',  amount - round(amount * kid.jar_save / 100.0) - round(amount * kid.jar_spend / 100.0), case when kind = 'quiz' then 'Quiz reward' else 'Game reward' end);
  end if;
  if pts > 0 then
    insert into points_ledger (family_id, child_id, delta, reason)
      values (kid.family_id, kid.id, pts, case when kind = 'quiz' then 'Quiz: ' || n || ' right' else 'Game: ' || n || ' right' end);
  end if;

  return json_build_object('mode', kid.quiz_reward_mode, 'amount_pence', amount, 'points', pts, 'already', false);
end;
$$;
revoke execute on function award_learning(uuid, text, text, int) from public, anon;

create or replace function request_reward(target_reward_id uuid)
returns reward_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  kid uuid := my_child_id();
  rw record;
  balance int;
  req reward_requests;
begin
  if kid is null then raise exception 'Only a child can ask for a reward from their own device.'; end if;
  select * into rw from rewards where id = target_reward_id and family_id = my_family_id() and active and (child_id is null or child_id = kid);
  if rw is null then raise exception 'Reward not found.'; end if;
  select coalesce(sum(delta), 0) into balance from points_ledger where child_id = kid;
  if balance < rw.cost_points then raise exception 'Not enough points yet.'; end if;
  if exists (select 1 from reward_requests where child_id = kid and reward_id = rw.id and status = 'requested') then
    raise exception 'You''ve already asked for that — a grown-up will answer soon.';
  end if;

  insert into reward_requests (family_id, child_id, reward_id, reward_name, reward_icon, cost_points)
    values (rw.family_id, kid, rw.id, rw.name, rw.icon, rw.cost_points)
    returning * into req;
  insert into points_ledger (family_id, child_id, delta, reason)
    values (rw.family_id, kid, -rw.cost_points, 'Asked for: ' || rw.name);
  return req;
end;
$$;
revoke execute on function request_reward(uuid) from public, anon;

create or replace function decide_reward(request_id uuid, grant_it boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  if not is_parent() then raise exception 'Only a parent can decide rewards.'; end if;
  select * into req from reward_requests where id = request_id and family_id = my_family_id();
  if req is null then raise exception 'Request not found.'; end if;
  if req.status <> 'requested' then raise exception 'Already decided.'; end if;
  update reward_requests set status = case when grant_it then 'granted' else 'declined' end, decided_at = now() where id = req.id;
  if not grant_it then
    insert into points_ledger (family_id, child_id, delta, reason)
      values (req.family_id, req.child_id, req.cost_points, 'Returned: ' || req.reward_name);
  end if;
end;
$$;
revoke execute on function decide_reward(uuid, boolean) from public, anon;

-- Parents may also hand out or take back points by hand ("bonus for being kind").
create or replace function adjust_points(target_child_id uuid, delta int, why text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_parent() then raise exception 'Only a parent can change points.'; end if;
  if delta = 0 or abs(delta) > 1000 then raise exception 'Choose an amount between 1 and 1000.'; end if;
  if not exists (select 1 from children where id = target_child_id and family_id = my_family_id()) then
    raise exception 'Child not found.';
  end if;
  insert into points_ledger (family_id, child_id, delta, reason)
    values (my_family_id(), target_child_id, delta, coalesce(nullif(trim(why), ''), case when delta > 0 then 'Bonus from a grown-up' else 'Taken by a grown-up' end));
end;
$$;
revoke execute on function adjust_points(uuid, int, text) from public, anon;

-- The child may change nothing about their own reward settings.
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
     or new.locked_until is distinct from old.locked_until
     or new.quiz_reward_mode is distinct from old.quiz_reward_mode
     or new.quiz_reward_pence is distinct from old.quiz_reward_pence
     or new.quiz_points_per_correct is distinct from old.quiz_points_per_correct then
    raise exception 'Only a parent can change that.';
  end if;
  return new;
end;
$$;

alter publication supabase_realtime add table reward_requests, points_ledger;
