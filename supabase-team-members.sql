-- Run in Supabase SQL Editor

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

alter publication supabase_realtime add table team_members;

alter table team_members enable row level security;
create policy "Allow all" on team_members for all using (true) with check (true);

insert into team_members (name, sort_order) values
  ('Ally',    1),
  ('Ben',     2),
  ('Chas',    3),
  ('Adam',    4),
  ('DeWayne', 5),
  ('Ray',     6),
  ('John',    7),
  ('Mickey',  8);
