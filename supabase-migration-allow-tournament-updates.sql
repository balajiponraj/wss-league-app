-- Allow both anonymous scorekeepers and authenticated admins to update tournament status
-- (e.g. marking a tournament as completed, changing visibility, etc.)

drop policy if exists "WSS tournaments can be updated" on public.tournaments;
create policy "WSS tournaments can be updated"
  on public.tournaments for update
  to anon, authenticated
  using (true)
  with check (true);

NOTIFY pgrst, 'reload schema';
