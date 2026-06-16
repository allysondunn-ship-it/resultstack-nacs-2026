-- Run in Supabase SQL Editor

create table if not exists budget_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null,
  created_at timestamptz not null default now()
);

alter publication supabase_realtime add table budget_items;

alter table budget_items enable row level security;
create policy "Allow all" on budget_items for all using (true) with check (true);
