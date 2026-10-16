-- Chore scheduling: any days this week (×N), every day, or specific dates
-- planned on an 8-day calendar. `times_per_week` keeps its meaning ("how
-- many completions this week") and is now derived from the schedule, so the
-- weekly budget split and the app's maths carry on unchanged.

alter table chores add column if not exists schedule text not null default 'weekly';
alter table chores add column if not exists dates date[] not null default '{}';
alter table chores add constraint chores_schedule_check check (schedule in ('weekly', 'daily', 'dates'));

alter table chore_claims add column if not exists for_day date not null default current_date;
create index if not exists chore_claims_day_idx on chore_claims(chore_id, child_id, for_day);

-- Completions this week implied by the schedule (weeks start Monday).
create or replace function effective_times_per_week(sched text, n int, planned date[])
returns int language sql immutable as $$
  select case
    when sched = 'daily' then 7
    when sched = 'dates' then greatest(1, (
      select count(*)::int from unnest(planned) d
      where d >= date_trunc('week', current_date)::date and d < (date_trunc('week', current_date) + interval '7 days')::date
    ))
    else greatest(1, least(coalesce(n, 1), 14))
  end;
$$;

create or replace function chores_schedule_trg()
returns trigger language plpgsql as $$
begin
  if new.schedule = 'dates' then
    -- keep the list tidy: unique, sorted, nothing in the past
    select coalesce(array_agg(d order by d), '{}') into new.dates
      from (select distinct unnest(new.dates) d) s where d >= current_date - 1;
  else
    new.dates := '{}';
  end if;
  new.times_per_week := effective_times_per_week(new.schedule, new.times_per_week, new.dates);
  return new;
end;
$$;
create or replace trigger chores_schedule before insert or update on chores
  for each row execute function chores_schedule_trg();

-- Called when the app opens: as weeks roll over, date-planned chores may
-- have a different number of completions this week. Re-deriving
-- times_per_week fires the existing rebalance trigger.
create or replace function refresh_chore_schedules()
returns void language sql security definer set search_path = public as $$
  update chores set times_per_week = effective_times_per_week(schedule, times_per_week, dates)
  where family_id = my_family_id() and active and schedule = 'dates'
    and times_per_week is distinct from effective_times_per_week(schedule, times_per_week, dates);
$$;
revoke execute on function refresh_chore_schedules() from public, anon;

-- claim_chore now takes the day the chore was done (the device's local
-- date), so "every day" and planned-date chores are limited to once per day.
create or replace function claim_chore(target_chore_id uuid, target_child_id uuid, claim_day date)
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
  if claim_day is null or claim_day < current_date - 1 or claim_day > current_date + 1 then
    claim_day := current_date;
  end if;

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

  if ch.schedule = 'dates' and not (claim_day = any(ch.dates)) then
    raise exception 'That chore isn''t planned for today.';
  end if;

  if ch.schedule in ('daily', 'dates') then
    if exists (
      select 1 from chore_claims
      where chore_id = ch.id and child_id = kid.id and for_day = claim_day and status in ('pending', 'approved')
    ) then
      raise exception 'That chore is already done for today.';
    end if;
  else
    select count(*) into done from chore_claims
      where chore_id = ch.id and child_id = kid.id
        and status in ('pending', 'approved')
        and claimed_at >= date_trunc('week', now());
    if done >= ch.times_per_week then
      raise exception 'That chore is already done for this week.';
    end if;
  end if;

  insert into chore_claims (family_id, chore_id, child_id, for_day)
    values (ch.family_id, ch.id, kid.id, claim_day)
    returning * into new_claim;
  return new_claim;
end;
$$;
revoke execute on function claim_chore(uuid, uuid, date) from public, anon;

-- Older clients still call the two-argument form.
create or replace function claim_chore(target_chore_id uuid, target_child_id uuid)
returns chore_claims language sql security definer set search_path = public as $$
  select claim_chore(target_chore_id, target_child_id, current_date);
$$;
