alter table public.tournaments
  add column if not exists group_a text not null default 'WSS',
  add column if not exists group_b text not null default 'DCSC',
  add column if not exists teams_per_group integer not null default 7;

alter table public.teams
  add column if not exists "tournamentId" text references public.tournaments(id);

alter table public.matches
  add column if not exists stage text not null default 'round_robin',
  add column if not exists "bracketKey" text;

drop policy if exists "WSS matches can be updated" on public.matches;
create policy "WSS matches can be updated"
  on public.matches for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "WSS matches can be deleted" on public.matches;
create policy "WSS matches can be deleted" on public.matches for delete to anon, authenticated using (true);

drop policy if exists "WSS players can be deleted" on public.players;
create policy "WSS players can be deleted" on public.players for delete to anon, authenticated using (true);
drop policy if exists "WSS teams can be deleted" on public.teams;
create policy "WSS teams can be deleted" on public.teams for delete to anon, authenticated using (true);
drop policy if exists "WSS tournaments can be deleted" on public.tournaments;
create policy "WSS tournaments can be deleted" on public.tournaments for delete to anon, authenticated using (true);
drop policy if exists "WSS teams can be updated" on public.teams;
create policy "WSS teams can be updated" on public.teams for update to anon, authenticated using (true) with check (true);
drop policy if exists "WSS tournaments can be updated" on public.tournaments;
create policy "WSS tournaments can be updated" on public.tournaments for update to anon, authenticated using (true) with check (true);

drop policy if exists "WSS players can be added" on public.players;
drop policy if exists "WSS players can be added by admins" on public.players;
create policy "WSS players can be added by admins" on public.players for insert to authenticated with check (true);
drop policy if exists "WSS players can be updated" on public.players;
create policy "WSS players can be updated" on public.players for update to authenticated using (true) with check (true);
drop policy if exists "WSS players can be deleted" on public.players;
create policy "WSS players can be deleted" on public.players for delete to authenticated using (true);

drop policy if exists "WSS teams can be added" on public.teams;
drop policy if exists "WSS teams can be added by admins" on public.teams;
create policy "WSS teams can be added by admins" on public.teams for insert to authenticated with check (true);
drop policy if exists "WSS teams can be updated" on public.teams;
create policy "WSS teams can be updated" on public.teams for update to authenticated using (true) with check (true);
drop policy if exists "WSS teams can be deleted" on public.teams;
create policy "WSS teams can be deleted" on public.teams for delete to authenticated using (true);

drop policy if exists "WSS tournaments can be added" on public.tournaments;
drop policy if exists "WSS tournaments can be added by admins" on public.tournaments;
create policy "WSS tournaments can be added by admins" on public.tournaments for insert to authenticated with check (true);
drop policy if exists "WSS tournaments can be updated" on public.tournaments;
create policy "WSS tournaments can be updated" on public.tournaments for update to authenticated using (true) with check (true);
drop policy if exists "WSS tournaments can be deleted" on public.tournaments;
create policy "WSS tournaments can be deleted" on public.tournaments for delete to authenticated using (true);

NOTIFY pgrst, 'reload schema';