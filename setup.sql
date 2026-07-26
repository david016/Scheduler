-- Spusti v Supabase: SQL Editor → New query → vlož a Run

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time time not null,
  place text not null,
  note text default '',
  created_at timestamptz default now()
);

create table if not exists signups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  willing_2v2 boolean not null default false,
  created_at timestamptz default now(),
  unique (event_id, name)
);

-- Otvorený prístup pre anon kľúč (stačí pre súkromnú partiu;
-- kľúč pozná len ten, kto má link na appku)
alter table events enable row level security;
alter table signups enable row level security;

drop policy if exists "open events" on events;
drop policy if exists "open signups" on signups;
create policy "open events" on events for all using (true) with check (true);
create policy "open signups" on signups for all using (true) with check (true);

-- Zapni realtime pre obe tabuľky (idempotentne — ignoruj ak už sú v publikácii)
do $$ begin
  alter publication supabase_realtime add table events;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table signups;
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────────────────────
-- MIGRÁCIA pre existujúce inštalácie (spusti ak si už mal setup):
-- ─────────────────────────────────────────────────────────────
alter table signups add column if not exists willing_2v2 boolean not null default false;
alter table events drop column if exists capacity;
