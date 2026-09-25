-- ============================================================
-- ANIMELK - Custom subtitles
-- 1) adds subtitle track storage to episodes
-- 2) creates a public storage bucket + policies for .vtt files
-- Run in the Supabase SQL editor.
-- ============================================================

alter table public.episodes
  add column if not exists subtitles jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('subtitles', 'subtitles', true)
on conflict (id) do nothing;

drop policy if exists "public read subtitles" on storage.objects;
create policy "public read subtitles"
  on storage.objects for select
  using (bucket_id = 'subtitles');

drop policy if exists "admin manage subtitles" on storage.objects;
create policy "admin manage subtitles"
  on storage.objects for all
  using (
    bucket_id = 'subtitles'
    and auth.role() = 'authenticated'
    and public.is_admin()
  )
  with check (
    bucket_id = 'subtitles'
    and auth.role() = 'authenticated'
    and public.is_admin()
  );
