-- Run this once to fix corrupted standings caused by duplicate round-robin match rows.
-- It is safe: it only removes duplicate rows for the SAME fixture (same tournament + same two teams),
-- keeping the most recently saved result, and then prevents this from happening again.

-- 1) Show duplicates first (optional, for your own review before deleting).
select "tournamentId", least("teamAId","teamBId") as team_low, greatest("teamAId","teamBId") as team_high, count(*)
from public.matches
where "teamAId" is not null and "teamBId" is not null and (stage is null or stage = 'round_robin')
group by 1, 2, 3
having count(*) > 1;

-- 2) Delete the duplicates, keeping only the most recently saved row per fixture.
with ranked as (
  select id,
         row_number() over (
           partition by "tournamentId", least("teamAId","teamBId"), greatest("teamAId","teamBId")
           order by "createdAt" desc
         ) as rn
  from public.matches
  where "teamAId" is not null and "teamBId" is not null and (stage is null or stage = 'round_robin')
)
delete from public.matches
where id in (select id from ranked where rn > 1);

-- 3) Prevent this from ever happening again: one round-robin result per fixture per tournament.
create unique index if not exists matches_unique_round_robin_fixture
  on public.matches ("tournamentId", least("teamAId","teamBId"), greatest("teamAId","teamBId"))
  where "teamAId" is not null and "teamBId" is not null and (stage is null or stage = 'round_robin');

NOTIFY pgrst, 'reload schema';
