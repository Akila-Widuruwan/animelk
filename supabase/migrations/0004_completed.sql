-- ============================================================
-- ANIMELK - Manually-controlled "Completed" status for anime
-- Adds a boolean flag the admin toggles; the public site shows
-- a COMPLETED badge only when it is true.
-- Run in the Supabase SQL editor.
-- ============================================================

alter table public.anime
  add column if not exists completed boolean not null default false;
