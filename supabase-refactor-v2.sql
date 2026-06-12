-- ============================================================
-- STEP 1 — Run this BEFORE the new Vercel deploy goes live.
-- Safe to run multiple times (all ops are idempotent).
-- ============================================================

-- 1a. Add new columns to deadlines (no-op if already present)
alter table deadlines
  add column if not exists approval_date date,
  add column if not exists category text;

-- ============================================================
-- STEP 2 — Create subtasks table
-- ============================================================
create table if not exists subtasks (
  id           uuid primary key default gen_random_uuid(),
  deadline_id  uuid not null references deadlines(id) on delete cascade,
  title        text not null,
  done         boolean not null default false,
  owner        text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

alter table subtasks enable row level security;
create policy "Allow all" on subtasks for all using (true) with check (true);
alter publication supabase_realtime add table subtasks;

-- ============================================================
-- STEP 3 — Migrate workstream_items → deadlines
--           workstream_subitems → subtasks
--           then drop the old tables
-- (Wrapped in a block so it no-ops if the old tables are gone)
-- ============================================================
do $$
begin
  if exists (
    select from information_schema.tables
    where table_schema = 'public' and table_name = 'workstream_items'
  ) then

    -- Build a temp mapping: old item id → new deadline id
    create temp table _item_map (
      old_id         uuid,
      new_deadline_id uuid
    ) on commit drop;

    insert into _item_map (old_id, new_deadline_id)
    select id, gen_random_uuid() from workstream_items;

    -- Insert old items as deadlines
    insert into deadlines (id, item, workstream, bucket, status, is_critical, updated_at)
    select
      m.new_deadline_id,
      wi.text,
      wi.workstream_id,
      case
        when wi.workstream_id in (1,2,3)   then 1
        when wi.workstream_id in (4,5,6,7) then 2
        when wi.workstream_id in (8,9)     then 3
        when wi.workstream_id in (10,11)   then 4
        else 5
      end,
      'not_started',
      false,
      now()
    from workstream_items wi
    join _item_map m on m.old_id = wi.id;

    -- Migrate subitems if that table also exists
    if exists (
      select from information_schema.tables
      where table_schema = 'public' and table_name = 'workstream_subitems'
    ) then
      insert into subtasks (deadline_id, title, done, sort_order)
      select
        m.new_deadline_id,
        ws.text,
        false,
        ws.sort_order
      from workstream_subitems ws
      join _item_map m on m.old_id = ws.item_id;

      drop table workstream_subitems;
    end if;

    drop table workstream_items;
  end if;
end $$;
