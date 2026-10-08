-- ============================================================
-- ANIMELK - Rename the homepage "New Anime" row to "Completed Anime"
-- The row now only shows titles whose status is FINISHED. The
-- filtering happens in the app (src/lib/db.ts) so the slug is kept
-- for backwards compatibility with the admin import tools.
-- Run in the Supabase SQL editor.
-- ============================================================

update public.sections
  set title = 'Completed Anime'
  where slug = 'new-anime';
