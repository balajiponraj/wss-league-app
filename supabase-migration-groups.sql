create table if not exists public.groups (
  id text primary key,
  name text not null unique
);

insert into public.groups (id, name) values
  ('WSS', 'WSS'), ('FFBC', 'FFBC'), ('SW', 'SW'),
  ('SSBC', 'SSBC'), ('DBCC', 'DBCC'), ('DCSC', 'DCSC')
on conflict (id) do nothing;

alter table public.groups enable row level security;
drop policy if exists "WSS groups can be read" on public.groups;
drop policy if exists "WSS groups can be added by admins" on public.groups;
create policy "WSS groups can be read" on public.groups for select to anon, authenticated using (true);
create policy "WSS groups can be added by admins" on public.groups for insert to authenticated with check (true);

NOTIFY pgrst, 'reload schema';