-- ============================================================
-- ANIMELK - Custom subtitle uploads
-- 1) creates the public 'subtitles' storage bucket (safe if it
--    was never created, or was deleted)
-- 2) lets admins AND staff upload / replace / delete .vtt files
--    there, while everyone can read them.
--
-- Run in the Supabase SQL editor (safe to re-run).
-- The episode subtitle track itself lives in episodes.subtitles.
-- ============================================================

-- ---------- 1. Bucket ----------
insert into storage.buckets (id, name, public)
values ('subtitles', 'subtitles', true)
on conflict (id) do update set public = true;

-- ---------- 2. Read for everyone ----------
drop policy if exists "public read subtitles" on storage.objects;
create policy "public read subtitles"
  on storage.objects for select
  using (bucket_id = 'subtitles');

-- ---------- 3. Upload / replace / delete for admins & staff ----------
-- Roles are read straight from public.profiles so this migration does
-- not depend on the helper functions created by 0005_staff.sql.
drop policy if exists "admin manage subtitles" on storage.objects;
drop policy if exists "staff manage subtitles" on storage.objects;
create policy "staff manage subtitles"
  on storage.objects for all
  using (
    bucket_id = 'subtitles'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
  )
  with check (
    bucket_id = 'subtitles'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
  );
