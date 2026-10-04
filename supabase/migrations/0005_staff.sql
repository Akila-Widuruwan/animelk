-- ============================================================
-- ANIMELK - Staff submissions & approval workflow
--
-- 1) adds a 'staff' role (uploaders who cannot touch live anime)
-- 2) adds moderation columns to anime so new uploads start as
--    'pending' and are invisible on the public site until an
--    admin/owner approves them
-- 3) rewrites RLS: everyone reads only approved anime; staff
--    can insert their own submissions and edit them while they
--    are still pending, but can never delete or edit live anime.
--
-- Run in the Supabase SQL editor (safe to re-run).
-- ============================================================

-- ---------- 1. Allow the 'staff' role ----------
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('member', 'staff', 'admin'));

-- ---------- 2. Moderation columns on anime ----------
alter table public.anime
  add column if not exists moderation_status text not null default 'approved';
alter table public.anime
  drop constraint if exists anime_moderation_status_check;
alter table public.anime
  add constraint anime_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'rejected'));

alter table public.anime
  add column if not exists submitted_by uuid references auth.users(id) on delete set null;
alter table public.anime
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.anime
  add column if not exists reviewed_at timestamptz;
alter table public.anime
  add column if not exists review_note text;

create index if not exists anime_moderation_idx
  on public.anime (moderation_status, created_at desc);
create index if not exists anime_submitted_by_idx
  on public.anime (submitted_by);

-- Existing catalogue is already live.
update public.anime set moderation_status = 'approved'
  where moderation_status is null;

-- ---------- 3. Helper functions ----------
create or replace function public.is_staff() returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'staff'
  );
$$ language sql stable security definer;

-- True when the current user owns the (pending) submission it points at.
create or replace function public.staff_owns_pending_anime(aid bigint)
returns boolean as $$
  select exists (
    select 1 from public.anime
    where id = aid
      and submitted_by = auth.uid()
      and moderation_status = 'pending'
  );
$$ language sql stable security definer;

-- ---------- 4. Rewrite public read policies ----------
-- Public (anon) viewers only ever see approved content.
drop policy if exists "public read anime" on public.anime;
create policy "public read anime" on public.anime
  for select using (moderation_status = 'approved');

drop policy if exists "public read episodes" on public.episodes;
create policy "public read episodes" on public.episodes
  for select using (
    exists (
      select 1 from public.anime a
      where a.id = episodes.anime_id and a.moderation_status = 'approved'
    )
  );

drop policy if exists "public read anime_genres" on public.anime_genres;
create policy "public read anime_genres" on public.anime_genres
  for select using (
    exists (
      select 1 from public.anime a
      where a.id = anime_genres.anime_id and a.moderation_status = 'approved'
    )
  );

-- ---------- 5. Staff policies ----------
-- Staff can read their own submissions (any status, so they can
-- see "pending"/"rejected" feedback).
drop policy if exists "staff read own anime" on public.anime;
create policy "staff read own anime" on public.anime
  for select using (submitted_by = auth.uid());

-- Staff create submissions that always start pending and are
-- always attributed to themselves.
drop policy if exists "staff insert own anime" on public.anime;
create policy "staff insert own anime" on public.anime
  for insert with check (
    submitted_by = auth.uid()
    and moderation_status = 'pending'
  );

-- Staff may only update their own submissions while still pending,
-- and cannot flip the moderation state or reassign ownership.
drop policy if exists "staff update own pending anime" on public.anime;
create policy "staff update own pending anime" on public.anime
  for update using (
    submitted_by = auth.uid() and moderation_status = 'pending'
  ) with check (
    submitted_by = auth.uid() and moderation_status = 'pending'
  );

-- No delete policy for staff: deletes are denied by RLS.

-- Episodes that belong to a staff member's own pending submission.
drop policy if exists "staff read own episodes" on public.episodes;
create policy "staff read own episodes" on public.episodes
  for select using (public.staff_owns_pending_anime(anime_id));
drop policy if exists "staff insert own episodes" on public.episodes;
create policy "staff insert own episodes" on public.episodes
  for insert with check (public.staff_owns_pending_anime(anime_id));
drop policy if exists "staff update own episodes" on public.episodes;
create policy "staff update own episodes" on public.episodes
  for update using (public.staff_owns_pending_anime(anime_id))
  with check (public.staff_owns_pending_anime(anime_id));
drop policy if exists "staff delete own episodes" on public.episodes;
create policy "staff delete own episodes" on public.episodes
  for delete using (public.staff_owns_pending_anime(anime_id));

-- Genre links that belong to a staff member's own pending submission.
drop policy if exists "staff manage own anime_genres" on public.anime_genres;
create policy "staff manage own anime_genres" on public.anime_genres
  for all using (public.staff_owns_pending_anime(anime_id))
  with check (public.staff_owns_pending_anime(anime_id));

-- ---------- 6. Admin/owner management ----------
-- Admins keep full control of every anime (approve/reject/edit/delete).
drop policy if exists "admin manage anime" on public.anime;
create policy "admin manage anime" on public.anime
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- 7. Clean up an earlier 'worker'-named draft ----------
-- Harmless if it was never applied; needed if you ran the version of this
-- migration that used the role name 'worker' before it was renamed to 'staff'.
drop policy if exists "worker read own anime" on public.anime;
drop policy if exists "worker insert own anime" on public.anime;
drop policy if exists "worker update own pending anime" on public.anime;
drop policy if exists "worker read own episodes" on public.episodes;
drop policy if exists "worker insert own episodes" on public.episodes;
drop policy if exists "worker update own episodes" on public.episodes;
drop policy if exists "worker delete own episodes" on public.episodes;
drop policy if exists "worker manage own anime_genres" on public.anime_genres;
drop function if exists public.worker_owns_pending_anime(bigint);
drop function if exists public.is_worker();
