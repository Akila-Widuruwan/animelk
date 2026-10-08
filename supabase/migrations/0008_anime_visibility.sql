-- ============================================================
-- ANIMELK - Per-anime visibility toggle
-- Adds a boolean flag the admin flips in Admin -> Anime.
--   true  -> the title is published on the public website (default)
--   false -> the title is hidden everywhere on the public site while
--            staying fully visible and editable in the admin panel.
-- Existing rows default to true, so nothing disappears when this runs.
-- Run in the Supabase SQL editor.
-- ============================================================

alter table public.anime
  add column if not exists is_active boolean not null default true;

create index if not exists anime_active_idx on public.anime (is_active);
