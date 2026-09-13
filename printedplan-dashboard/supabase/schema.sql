-- ============================================================
-- PrintedPlanCompany Dashboard — Supabase schema
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is idempotent.
-- ============================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
do $$ begin
  create type product_status as enum ('live', 'ready', 'production', 'idea');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pin_status as enum ('scheduled', 'live', 'in_design', 'needs_caption');
exception when duplicate_object then null; end $$;

do $$ begin
  create type post_pillar as enum ('breakdown', 'problem', 'lesson', 'journey');
exception when duplicate_object then null; end $$;

do $$ begin
  create type post_status as enum ('ready', 'scheduled', 'posted', 'draft');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------
create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  price             numeric(10,2) not null default 0,
  status            product_status not null default 'idea',
  etsy_url          text,
  etsy_views_30d    integer not null default 0,
  etsy_sales_30d    integer not null default 0,
  etsy_revenue_30d  numeric(10,2) not null default 0,
  images_ready      boolean not null default false,
  copy_ready        boolean not null default false,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists pinterest_pins (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete cascade,
  pin_name        text not null,
  caption         text not null default '',
  board           text not null default '',
  status          pin_status not null default 'needs_caption',
  scheduled_date  date,
  scheduled_time  time,
  pinterest_url   text,
  clicks_7d       integer not null default 0,
  impressions_7d  integer not null default 0,
  saves_7d        integer not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists instagram_posts (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid references products(id) on delete set null,
  post_number     integer not null,
  post_date       date not null,
  pillar          post_pillar,
  hook            text not null default '',
  caption_full    text not null default '',
  status          post_status not null default 'draft',
  images_ready    boolean not null default false,
  posted_date     date,
  instagram_url   text,
  likes           integer not null default 0,
  saves           integer not null default 0,
  comments        integer not null default 0,
  clicks_to_etsy  integer not null default 0,
  conversions     integer not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists daily_performance (
  id                     uuid primary key default gen_random_uuid(),
  date                   date not null unique,
  etsy_revenue           numeric(10,2) not null default 0,
  etsy_sales             integer not null default 0,
  etsy_views             integer not null default 0,
  pinterest_clicks       integer not null default 0,
  pinterest_impressions  integer not null default 0,
  instagram_likes        integer not null default 0,
  instagram_saves        integer not null default 0,
  instagram_clicks       integer not null default 0,
  top_product_revenue    text,
  top_pin_clicks         text,
  top_post_engagement    text,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists copy_library (
  id                      uuid primary key default gen_random_uuid(),
  product_id              uuid not null unique references products(id) on delete cascade,
  etsy_description_short  text,
  etsy_description_full   text,
  pinterest_caption_1     text,
  pinterest_caption_2     text,
  pinterest_caption_3     text,
  instagram_post_1        text,
  instagram_post_2        text,
  instagram_post_3        text,
  -- Variants beyond the third live here so the library can hold unlimited copy.
  pinterest_captions_extra jsonb not null default '[]'::jsonb,
  instagram_posts_extra    jsonb not null default '[]'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists content_pipeline (
  id                      uuid primary key default gen_random_uuid(),
  product_id              uuid not null unique references products(id) on delete cascade,
  idea_complete           boolean not null default true,
  template_built          boolean not null default false,
  images_done             boolean not null default false,
  etsy_copy_written       boolean not null default false,
  pinterest_copy_written  boolean not null default false,
  instagram_post_written  boolean not null default false,
  fully_ready             boolean generated always as (
    idea_complete and template_built and images_done
    and etsy_copy_written and pinterest_copy_written and instagram_post_written
  ) stored,
  due_date                date,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------
create index if not exists pinterest_pins_product_idx on pinterest_pins(product_id);
create index if not exists pinterest_pins_sched_idx on pinterest_pins(scheduled_date);
create index if not exists instagram_posts_product_idx on instagram_posts(product_id);
create index if not exists instagram_posts_date_idx on instagram_posts(post_date);
create index if not exists content_pipeline_due_idx on content_pipeline(due_date);

-- ------------------------------------------------------------
-- updated_at maintenance
-- ------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['products','pinterest_pins','instagram_posts','daily_performance','copy_library','content_pipeline']
  loop
    execute format('drop trigger if exists %I_set_updated_at on %I', t, t);
    execute format('create trigger %I_set_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- Every product automatically gets a pipeline row and a copy-library row,
-- so the Content Pipeline and Copy Library pages always list every product.
create or replace function create_product_companions() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into content_pipeline (product_id) values (new.id) on conflict (product_id) do nothing;
  insert into copy_library (product_id) values (new.id) on conflict (product_id) do nothing;
  return new;
end $$;

drop trigger if exists products_create_companions on products;
create trigger products_create_companions
  after insert on products for each row execute function create_product_companions();

-- Keep the stored etsy_revenue_30d column in step with sales * price.
-- (The UI calculates revenue live; this keeps exports/backups consistent.)
create or replace function sync_product_revenue() returns trigger
language plpgsql set search_path = public as $$
begin
  new.etsy_revenue_30d = round(coalesce(new.etsy_sales_30d, 0) * coalesce(new.price, 0), 2);
  return new;
end $$;

drop trigger if exists products_sync_revenue on products;
create trigger products_sync_revenue
  before insert or update of price, etsy_sales_30d on products
  for each row execute function sync_product_revenue();

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY — authenticated users only, all operations
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['products','pinterest_pins','instagram_posts','daily_performance','copy_library','content_pipeline']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated select" on %I', t);
    execute format('drop policy if exists "authenticated insert" on %I', t);
    execute format('drop policy if exists "authenticated update" on %I', t);
    execute format('drop policy if exists "authenticated delete" on %I', t);
    execute format('create policy "authenticated select" on %I for select to authenticated using (true)', t);
    execute format('create policy "authenticated insert" on %I for insert to authenticated with check (true)', t);
    execute format('create policy "authenticated update" on %I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "authenticated delete" on %I for delete to authenticated using (true)', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Danger zone helper used by Settings -> "Delete all data"
-- ------------------------------------------------------------
create or replace function delete_all_dashboard_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'not allowed';
  end if;
  delete from daily_performance;
  delete from products; -- cascades to pins, copy_library, content_pipeline
  update instagram_posts set product_id = null;
  delete from instagram_posts;
end $$;

revoke all on function delete_all_dashboard_data() from public, anon;
grant execute on function delete_all_dashboard_data() to authenticated;

-- Trigger functions are only ever fired by triggers; keep them off the public RPC surface.
revoke all on function set_updated_at() from public, anon;
revoke all on function sync_product_revenue() from public, anon;
revoke all on function create_product_companions() from public, anon;
