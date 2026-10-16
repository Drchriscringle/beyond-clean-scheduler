-- Screen time: a child's device adds up the seconds the app is open and on
-- screen, one row per child per day. Parents read it from the Home tab.

create table if not exists child_usage (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null,
  child_id    uuid not null,
  day         date not null default current_date,
  seconds     int not null default 0 check (seconds between 0 and 86400),
  updated_at  timestamptz not null default now(),
  unique (child_id, day)
);
alter table child_usage enable row level security;

create policy "parents see usage" on child_usage
  for select using (family_id = my_family_id() and (is_parent() or child_id = my_child_id()));

-- The only way in: the child's own device adds a slice of time to today.
-- Capped per call so a stuck client can't inflate the total.
create or replace function record_child_usage(add_seconds int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  kid uuid := my_child_id();
  fam uuid := my_family_id();
  slice int := greatest(0, least(coalesce(add_seconds, 0), 300));
begin
  if kid is null or fam is null or slice = 0 then return; end if;
  insert into child_usage (family_id, child_id, day, seconds)
    values (fam, kid, current_date, slice)
    on conflict (child_id, day) do update
      set seconds = least(child_usage.seconds + excluded.seconds, 86400),
          updated_at = now();
end;
$$;
revoke execute on function record_child_usage(int) from public, anon;
