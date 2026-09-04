create table if not exists public.players (
  id text primary key,
  name text not null,
  skill text not null default 'Intermediate',
  club text not null default 'WSS',
  group_name text not null default 'A'
);

alter table public.players add column if not exists group_name text not null default 'A';

create table if not exists public.matches (
  id text primary key,
  "playerAId" text not null references public.players(id),
  "playerBId" text not null references public.players(id),
  "playerAScore" integer not null default 0,
  "playerBScore" integer not null default 0,
  "winnerId" text not null references public.players(id),
  note text not null default 'Club league',
  "createdAt" timestamptz not null default now(),
  constraint different_players check ("playerAId" <> "playerBId"),
  constraint valid_scores check ("playerAScore" >= 0 and "playerBScore" >= 0),
  constraint winner_is_player check ("winnerId" = "playerAId" or "winnerId" = "playerBId")
);

create table if not exists public.teams (
  id text primary key,
  name text not null,
  "playerAId" text not null references public.players(id),
  "playerBId" text not null references public.players(id),
  group_name text not null default 'A',
  constraint different_team_players check ("playerAId" <> "playerBId")
);

create table if not exists public.tournaments (
  id text primary key,
  name text not null,
  format text not null check (format in ('internal', 'external')),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.matches add column if not exists "teamAId" text references public.teams(id);
alter table public.matches add column if not exists "teamBId" text references public.teams(id);
alter table public.matches add column if not exists "tournamentId" text references public.tournaments(id);

alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.teams enable row level security;
alter table public.tournaments enable row level security;

drop policy if exists "WSS players can be read" on public.players;
drop policy if exists "WSS players can be added" on public.players;
drop policy if exists "WSS matches can be read" on public.matches;
drop policy if exists "WSS matches can be added" on public.matches;
drop policy if exists "WSS teams can be read" on public.teams;
drop policy if exists "WSS teams can be added" on public.teams;
drop policy if exists "WSS tournaments can be read" on public.tournaments;
drop policy if exists "WSS tournaments can be added" on public.tournaments;

create policy "WSS players can be read"
  on public.players for select
  to anon, authenticated
  using (true);

create policy "WSS players can be added"
  on public.players for insert
  to anon, authenticated
  with check (true);

create policy "WSS matches can be read"
  on public.matches for select
  to anon, authenticated
  using (true);

create policy "WSS matches can be added"
  on public.matches for insert
  to anon, authenticated
  with check (true);

create policy "WSS teams can be read"
  on public.teams for select
  to anon, authenticated
  using (true);

create policy "WSS teams can be added"
  on public.teams for insert
  to anon, authenticated
  with check (true);

create policy "WSS tournaments can be read"
  on public.tournaments for select
  to anon, authenticated
  using (true);

create policy "WSS tournaments can be added"
  on public.tournaments for insert
  to anon, authenticated
  with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table public.players;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams'
  ) then
    alter publication supabase_realtime add table public.teams;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tournaments'
  ) then
    alter publication supabase_realtime add table public.tournaments;
  end if;
end
$$;