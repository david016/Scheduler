-- Spusti v Supabase: SQL Editor → New query → vlož a Run

create table events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time time not null,
  place text not null,
  capacity int not null default 12,
  note text default '',
  created_at timestamptz default now()
);

create table signups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique (event_id, name)
);

-- Otvorený prístup pre anon kľúč (stačí pre súkromnú partiu;
-- kľúč pozná len ten, kto má link na appku)
alter table events enable row level security;
alter table signups enable row level security;

create policy "open events" on events for all using (true) with check (true);
create policy "open signups" on signups for all using (true) with check (true);

-- Zapni realtime pre obe tabuľky
alter publication supabase_realtime add table events, signups;
