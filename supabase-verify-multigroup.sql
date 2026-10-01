-- Run this to confirm the multigroup migration applied successfully.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'tournaments' and column_name = 'groups_json';

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'matches' and column_name in ('teamAPlayer2Id', 'teamBPlayer2Id');

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.tournaments'::regclass and contype = 'c';
