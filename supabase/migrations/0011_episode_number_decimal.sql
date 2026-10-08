-- ============================================================
-- ANIMELK - Episode numbers with a decimal part
--
-- episodes.episode_number was an integer, so half episodes
-- (12.5, 13.5) could not be stored at all. It becomes numeric,
-- following the same approach as 0003_duration_decimal.sql.
--
-- Whole numbers are unaffected: 13 still stores and sorts as 13,
-- and the existing unique (anime_id, episode_number) constraint
-- keeps working with the new type.
--
-- Note: numbering does not have to start at 1. A "Part 2" that
-- continues the previous part simply stores 13, 14, ... and the
-- site now lists only the episodes that exist.
--
-- Run in the Supabase SQL editor (safe to re-run).
-- ============================================================

alter table public.episodes
  alter column episode_number type numeric using episode_number::numeric;

-- Sorting and "latest episode" lookups go through this column.
create index if not exists episodes_number_idx
  on public.episodes (anime_id, episode_number);
