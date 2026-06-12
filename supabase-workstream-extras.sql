-- Run in Supabase SQL Editor BEFORE deploying the updated app.

-- =============================================
-- TABLE: workstream_notes (one row per workstream)
-- =============================================
create table if not exists workstream_notes (
  workstream_id int primary key check (workstream_id between 1 and 12),
  notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table workstream_notes enable row level security;
create policy "Allow all" on workstream_notes for all using (true) with check (true);
alter publication supabase_realtime add table workstream_notes;

-- Seed empty rows so upserts never need to insert from scratch
insert into workstream_notes (workstream_id, notes) values
  (1,''), (2,''), (3,''), (4,''),  (5,''),  (6,''),
  (7,''), (8,''), (9,''), (10,''),(11,''),(12,'')
on conflict do nothing;

-- =============================================
-- TABLE: workstream_items
-- =============================================
create table if not exists workstream_items (
  id uuid primary key default gen_random_uuid(),
  workstream_id int not null check (workstream_id between 1 and 12),
  text text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table workstream_items enable row level security;
create policy "Allow all" on workstream_items for all using (true) with check (true);
alter publication supabase_realtime add table workstream_items;

-- =============================================
-- TABLE: workstream_subitems
-- =============================================
create table if not exists workstream_subitems (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references workstream_items(id) on delete cascade,
  text text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table workstream_subitems enable row level security;
create policy "Allow all" on workstream_subitems for all using (true) with check (true);
alter publication supabase_realtime add table workstream_subitems;
