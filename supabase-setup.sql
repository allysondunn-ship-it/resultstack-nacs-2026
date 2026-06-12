-- Run this in your Supabase SQL editor (project > SQL Editor > New query)

-- =============================================
-- TABLE: deadlines
-- =============================================
create table if not exists deadlines (
  id uuid primary key default gen_random_uuid(),
  due_date date,
  item text not null,
  workstream int not null,
  bucket int not null,
  owner text,
  amount numeric,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','done','na')),
  is_critical boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at on any row change
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on deadlines;
create trigger set_updated_at
  before update on deadlines
  for each row execute function update_updated_at();

-- Enable realtime for live sync across all users
alter publication supabase_realtime add table deadlines;

-- =============================================
-- TABLE: decisions
-- =============================================
create table if not exists decisions (
  id int primary key,
  decision text not null,
  deadline text,
  owner text,
  notes text,
  resolved boolean not null default false
);

alter publication supabase_realtime add table decisions;

-- =============================================
-- ROW-LEVEL SECURITY (permissive for trusted team)
-- No login required in v1; all reads/writes are open.
-- To lock down later: enable RLS and add policies
-- requiring auth.uid() in your domain.
-- =============================================
alter table deadlines enable row level security;
alter table decisions enable row level security;

create policy "Allow all" on deadlines for all using (true) with check (true);
create policy "Allow all" on decisions for all using (true) with check (true);

-- =============================================
-- SEED: deadlines
-- =============================================
insert into deadlines (due_date, item, workstream, bucket, is_critical, amount, status, notes) values
  ('2026-06-26', 'Booth payment in full due', 1, 1, true, null, 'not_started', 'Verify paid; unpaid space may be reassigned, 2.95% card fee'),
  ('2026-07-15', 'NACS Expo Prep webinar (2 priority pts)', 12, 5, false, null, 'not_started', null),
  ('2026-07-28', 'Maritz Lead Retrieval early-bird ends', 1, 1, true, 490, 'not_started', 'SINGLE HIGHEST-PRIORITY active item. SWAP App Package $490 (3 activations); steps to $540 by 9/8, $590 after'),
  ('2026-07-31', 'Exhibitor Directory listing', 1, 1, true, null, 'not_started', 'Map Your Show; contact Trent Hoffman'),
  ('2026-08-03', 'Cool New Products Preview Room go/no-go', 6, 2, true, null, 'not_started', 'Pre-show buyer access; contact Nicole Walbe'),
  ('2026-08-07', 'Convenience Catalyst showcase cancellation', 6, 2, true, null, 'not_started', null),
  ('2026-08-14', 'NACS Onsite Guide ad space close', 6, 2, true, null, 'not_started', 'If advertising'),
  ('2026-08-14', 'Expo Map sponsorship close', 6, 2, true, 16000, 'not_started', '1 advertiser only'),
  ('2026-08-14', 'Hanging Signs deadline', 1, 1, false, null, 'na', 'N/A for 10x10 linear booth'),
  ('2026-08-21', 'NACS Onsite Guide materials due', 6, 2, true, null, 'not_started', null),
  ('2026-08-28', 'NACS Show Daily ad space close', 6, 2, true, null, 'not_started', null),
  ('2026-08-29', 'Off-site event approval deadline', 9, 3, true, null, 'not_started', 'Required for ANY event at NACS-block hotels/LVCC; no approval = cancellation, no refund'),
  ('2026-09-01', 'Shuttle bus ad materials due', 6, 2, false, 12500, 'not_started', null),
  ('2026-09-02', 'Freeman warehouse opens for shipments', 1, 1, false, null, 'not_started', null),
  ('2026-09-03', 'NACS Show Daily materials due', 6, 2, true, null, 'not_started', null),
  ('2026-09-04', 'Freeman discount deadline (flooring, furnishings, electrical)', 1, 1, true, 1500, 'not_started', 'Login required for pricing'),
  ('2026-09-04', 'Booth security guard advance rate', 1, 1, false, null, 'na', 'Only if storing valuables overnight'),
  ('2026-09-07', 'Cox Internet advance rate cutoff', 1, 1, true, 1500, 'not_started', 'Tier decision pending; see reference'),
  ('2026-09-08', 'Maritz Lead Retrieval mid-tier ends', 1, 1, false, null, 'not_started', 'Price rises after'),
  ('2026-09-22', 'Lowe equipment rental deadline', 1, 1, false, null, 'na', 'Foodservice only'),
  ('2026-09-24', 'Last warehouse delivery (no late fee)', 1, 1, false, null, 'not_started', null),
  ('2026-09-29', 'EAC registration (if third-party installer)', 1, 1, false, null, 'not_started', 'Default to Freeman labor'),
  ('2026-10-01', 'NACS Attendee Appointment time slots posted', 7, 2, false, null, 'not_started', null),
  ('2026-10-02', 'Show-site shipping begins', 1, 1, false, null, 'not_started', null),
  ('2026-10-05', 'Booth staff badge registration (no late fee)', 3, 1, true, null, 'not_started', 'Register all 8 attendees'),
  ('2026-10-06', 'Booth occupancy deadline (our 10x10)', 1, 1, false, null, 'not_started', 'Convention begins'),
  ('2026-10-07', 'EXPO opens', 1, 3, false, null, 'not_started', 'Staff booth all hours; min 2 people'),
  ('2026-10-09', 'Show closes 1:30pm; move-out 2pm', 9, 3, false, null, 'not_started', 'No early teardown — priority point penalties'),
  ('2026-10-09', 'Same-day post-show email to all scanned leads', 10, 4, false, null, 'not_started', null),
  ('2026-10-31', 'Post-show attendee list available', 4, 2, false, null, 'not_started', 'Non-refundable; no emails included'),
  ('2026-10-31', 'Advertising payment due for 2027 priority points', 6, 2, false, null, 'not_started', '$5K=2pts, $10K=5pts');

-- =============================================
-- SEED: decisions
-- =============================================
insert into decisions (id, decision, deadline, owner, notes, resolved) values
  (1,  'Tagline (1 of 8 shortlist)', 'Mid-July', 'Ally + Ben/Jay', 'Drives all booth design', false),
  (2,  'Demo product(s) — 1 or 2 from candidates', 'Mid-July', 'Ben + Jay', 'Drives demo prep', false),
  (3,  'Cox Internet tier', '2026-09-07', 'Ally + tech', 'Depends on demo needs', false),
  (4,  'Lead retrieval option (recommend SWAP App $490)', '2026-07-28', 'Ally', 'Single highest-priority active item', false),
  (5,  'Cool New Products submission (go/no-go)', '2026-08-03', 'Ally + Ben', 'Affects marketing strategy', false),
  (6,  'Online Directory tier (Gold/Platinum/Diamond)', 'ASAP for early-bird', 'Ally', 'Platinum budgeted at standard rate', false),
  (7,  'NACS paid advertising mix', '2026-08-14+', 'Ally + Ben + John', 'Big budget decision', false),
  (8,  'Off-site event(s) — yes/no, type', '2026-08-29', 'Ally + Ben', 'Venue booking should start now', false),
  (9,  'Physical collateral quantities', 'Mid-Aug', 'Ally', 'Production lead times', false),
  (10, 'Giveaway / swag', 'Mid-Aug', 'Ally', 'Lightweight + memorable', false),
  (11, 'Booth production vendor', 'ASAP', 'Ally + Ben', '4–6 wk production lead time', false),
  (12, 'Travel/hotel booking timing', 'NOW via Connections Housing', 'Ally', 'Hotel block fills', false),
  (13, 'Number of all-access passes', 'Before Oct 5', 'Ally + Ben', 'Booth includes 2', false),
  (14, 'EAC use (third-party installer)', '2026-09-29', 'Ally', 'Default to Freeman labor', false),
  (15, 'Demo Wi-Fi failover plan', 'Pre-show', 'Ally + tech', 'What if Cox shared drops', false);
