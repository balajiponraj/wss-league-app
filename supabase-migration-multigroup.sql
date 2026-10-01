-- Adds support for the "multigroup" tournament format: 3+ ranked groups where every
-- unique rank-pair within a group (seed 1+2, 1+3, 2+3...) faces the same rank-pair
-- from every other group, with player-level (not pair-level) standings.

-- Tournaments: store the ordered (ranked) player list per group as JSON.
alter table public.tournaments add column if not exists groups_json text;

-- Allow the new "multigroup" format value (the original check only allowed internal/external).
alter table public.tournaments drop constraint if exists tournaments_format_check;
alter table public.tournaments add constraint tournaments_format_check check (format in ('internal', 'external', 'multigroup'));

-- Matches: a multigroup match is 2v2 but partners rotate per fixture, so we store
-- all 4 individual players directly instead of relying on a persistent Team row.
-- playerAId/playerBId already exist and represent each side's first player;
-- these two new columns hold each side's second (rotating) partner.
alter table public.matches add column if not exists "teamAPlayer2Id" text;
alter table public.matches add column if not exists "teamBPlayer2Id" text;

NOTIFY pgrst, 'reload schema';
