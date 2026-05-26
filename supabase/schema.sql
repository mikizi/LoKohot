-- LoKohot — football team balancer
-- Run once in Supabase SQL editor, then set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.

-- Players roster
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  strength numeric(3, 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_name_unique unique (name),
  constraint players_strength_range check (
    strength is null or (strength >= 1 and strength <= 6)
  )
);

create index if not exists players_name_idx on public.players (name);
create index if not exists players_active_name_idx on public.players (active, name);

-- Game night session
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  constraint sessions_status_check check (status in ('draft', 'final'))
);

create index if not exists sessions_draft_created_idx
  on public.sessions (created_at desc)
  where status = 'draft';

-- Checked-in players for a session
create table if not exists public.session_players (
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  primary key (session_id, player_id)
);

-- Team assignments
create table if not exists public.team_assignments (
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  team text not null,
  primary key (session_id, player_id),
  constraint team_assignments_team_check check (team in ('blue', 'yellow', 'orange'))
);

-- Seed roster (idempotent by name)
insert into public.players (name, strength) values
  ('גדי לי', 6),
  ('אופק ברוך', 2),
  ('ישי פורשר', 2),
  ('שירן', 5),
  ('נסי', 5),
  ('רונן פיין', 2),
  ('ברקי', 2.5),
  ('מיקי', 3),
  ('אלכסיי', 4),
  ('כפיר', 4),
  ('אופיר', 1),
  ('עידו', 4),
  ('אביהוא', 2.5),
  ('טמסגן', 1),
  ('נאור', 5),
  ('גיא', 2),
  ('מאור', 2),
  ('עופרי', 4),
  ('דן', 6),
  ('ארז', 3),
  ('אלעד בושרי', 2.5),
  ('גילי', 3),
  ('גיא יהוד', 6),
  ('נרי מדר', 2),
  ('איתי', 4),
  ('חי עצמון', 4),
  ('עידן', 2),
  ('מיכאל אסולין', 3.5),
  ('אהרון', 6),
  ('אבי חוסרבי', 3),
  ('מאי מימון אסייג', 2.5),
  ('הראל משה', 2.5),
  ('דביר', 3),
  ('אלרן צור', 4),
  ('ליעד שירום', 3),
  ('נועם', 4),
  ('אדיר', null)
on conflict (name) do update set
  strength = excluded.strength,
  updated_at = now();

-- RLS
alter table public.players enable row level security;
alter table public.sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.team_assignments enable row level security;

drop policy if exists "players_select" on public.players;
drop policy if exists "players_insert" on public.players;
drop policy if exists "players_update" on public.players;

create policy "players_select"
  on public.players for select to anon, authenticated using (true);

create policy "players_insert"
  on public.players for insert to anon, authenticated
  with check (
    length(btrim(name)) between 1 and 80
    and (strength is null or (strength >= 1 and strength <= 6))
  );

create policy "players_update"
  on public.players for update to anon, authenticated
  using (true)
  with check (
    length(btrim(name)) between 1 and 80
    and (strength is null or (strength >= 1 and strength <= 6))
  );

drop policy if exists "sessions_select" on public.sessions;
drop policy if exists "sessions_insert" on public.sessions;
drop policy if exists "sessions_update" on public.sessions;

create policy "sessions_select"
  on public.sessions for select to anon, authenticated using (true);

create policy "sessions_insert"
  on public.sessions for insert to anon, authenticated
  with check (status in ('draft', 'final'));

create policy "sessions_update"
  on public.sessions for update to anon, authenticated
  using (true)
  with check (status in ('draft', 'final'));

drop policy if exists "session_players_select" on public.session_players;
drop policy if exists "session_players_insert" on public.session_players;
drop policy if exists "session_players_delete" on public.session_players;

create policy "session_players_select"
  on public.session_players for select to anon, authenticated using (true);

create policy "session_players_insert"
  on public.session_players for insert to anon, authenticated
  with check (true);

create policy "session_players_delete"
  on public.session_players for delete to anon, authenticated using (true);

drop policy if exists "team_assignments_select" on public.team_assignments;
drop policy if exists "team_assignments_insert" on public.team_assignments;
drop policy if exists "team_assignments_update" on public.team_assignments;
drop policy if exists "team_assignments_delete" on public.team_assignments;

create policy "team_assignments_select"
  on public.team_assignments for select to anon, authenticated using (true);

create policy "team_assignments_insert"
  on public.team_assignments for insert to anon, authenticated
  with check (team in ('blue', 'yellow', 'orange'));

create policy "team_assignments_update"
  on public.team_assignments for update to anon, authenticated
  using (true)
  with check (team in ('blue', 'yellow', 'orange'));

create policy "team_assignments_delete"
  on public.team_assignments for delete to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.players to anon, authenticated;
grant select, insert, update on public.sessions to anon, authenticated;
grant select, insert, delete on public.session_players to anon, authenticated;
grant select, insert, update, delete on public.team_assignments to anon, authenticated;
