-- ============================================================
-- ANIMELK - Episode duration with seconds precision
-- Changes episodes.duration from integer (minutes) to numeric
-- so values like 28.2 (28 min 12 sec) can be stored.
-- Run in the Supabase SQL editor.
-- ============================================================

alter table public.episodes
  alter column duration type numeric using duration::numeric;
