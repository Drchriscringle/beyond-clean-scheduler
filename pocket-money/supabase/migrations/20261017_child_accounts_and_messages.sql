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

create table if not exists child_devices (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null,
  child_id      uuid not null,
  user_id       uuid not null unique, -- the anonymous auth user that is this device
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

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null,
  child_id        uuid not null,
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
alter table push_subscriptions add column if not exists child_id uuid;
alter policy "insert own push subs" on push_subscriptions
  with check (
    family_id = my_family_id() and user_id = auth.uid()
    and ((is_parent() and audience = 'parent') or (audience = 'child' and child_id = my_child_id()))
  );
alter policy "select own push subs" on push_subscriptions
  using (user_id = auth.uid() or (is_parent() and family_id = my_family_id()));
alter policy "update own push subs" on push_subscriptions
  using (user_id = auth.uid() or (is_parent() and family_id = my_family_id()));

-- ---------- MANUAL STEP ----------
-- The hosted SQL tool holds statements containing DROP/DELETE for a
-- confirmation that never arrives, so these three row-removal guards are
-- applied by hand in the SQL editor (they stop a child device removing
-- rows the family-scoped policies would otherwise allow):
--
--   create trigger children_parent_only_del before delete on children for each row execute function parent_only_guard();
--   create trigger chores_parent_only_del   before delete on chores   for each row execute function parent_only_guard();
--   create trigger bills_parent_only_del    before delete on bills    for each row execute function parent_only_guard();
--
-- Also enable Authentication → Sign In / Providers → "Allow anonymous
-- sign-ins" in the Supabase dashboard: child devices are anonymous users.
