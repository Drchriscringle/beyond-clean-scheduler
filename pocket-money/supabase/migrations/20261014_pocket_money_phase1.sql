-- Phase 1 delta for an existing Pocket Ledger database. schema.sql remains
-- the full source of truth for a fresh project; this applies only what
-- changed on top of the original schema.

alter table families add column if not exists currency text not null default 'GBP';
alter table families add column if not exists stripe_customer_id text;
alter table families add column if not exists subscription_status text not null default 'trial';
alter table families add column if not exists trial_ends_at timestamptz;

-- Pre-existing families get a fresh 14 days from when billing was introduced,
-- not from their original creation date (which could already be in the past).
update families set trial_ends_at = now() + interval '14 days' where trial_ends_at is null;

create or replace function create_family(family_name text)
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

create or replace function check_child_pin(target_child_id uuid, candidate_pin text)
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

create or replace function delete_my_family()
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

-- Column-level lockdown: billing columns are written only by the
-- stripe-webhook edge function (service role), never by the client.
revoke update on families from authenticated;
grant update (name, currency) on families to authenticated;
