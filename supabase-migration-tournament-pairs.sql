alter table public.tournaments
  add column if not exists group_a text not null default 'WSS',
  add column if not exists group_b text not null default 'DCSC',
  add column if not exists teams_per_group integer not null default 7;

alter table public.teams
  add column if not exists "tournamentId" text references public.tournaments(id);

drop policy if exists "WSS matches can be updated" on public.matches;
create policy "WSS matches can be updated"
  on public.matches for update
  to anon, authenticated
  using (true)
  with check (true);

NOTIFY pgrst, 'reload schema';