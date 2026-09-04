alter table public.tournaments
  add column if not exists event_date timestamptz,
  add column if not exists location text not null default '';

NOTIFY pgrst, 'reload schema';
