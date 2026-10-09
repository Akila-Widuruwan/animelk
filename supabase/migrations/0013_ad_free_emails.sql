-- ============================================================
-- ANIMELK - Ad-free accounts
--
-- The site owner keeps a list of email addresses that should never
-- receive the Monetag tag. It is managed from the admin panel, and
-- public/ad-gate.js consults a cached answer for it before making a
-- single ad request.
--
-- SECURITY
--   The list itself is not public. A signed-in visitor may read the
--   one row that matches their own email address - that is how the
--   site knows to skip ads for the account - and only admins can
--   read or change the whole list.
--
-- Run in the Supabase SQL editor (safe to re-run).
-- ============================================================

create table if not exists public.ad_free_emails (
  email text primary key,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Addresses are stored lower-cased, so both the lookup and the policy can
-- compare them as plain text instead of asking Postgres for a case-fold.
alter table public.ad_free_emails
  drop constraint if exists ad_free_emails_email_check;
alter table public.ad_free_emails
  add constraint ad_free_emails_email_check
  check (email = lower(email) and position('@' in email) > 1);

alter table public.ad_free_emails enable row level security;

-- A visitor can ask about their own address and nothing else. auth.jwt() is
-- null for a signed-out browser, so the comparison never matches there.
drop policy if exists "read own ad-free row" on public.ad_free_emails;
create policy "read own ad-free row" on public.ad_free_emails
  for select using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Admins manage the list.
drop policy if exists "admin read ad-free" on public.ad_free_emails;
create policy "admin read ad-free" on public.ad_free_emails
  for select using (public.is_admin());

drop policy if exists "admin insert ad-free" on public.ad_free_emails;
create policy "admin insert ad-free" on public.ad_free_emails
  for insert with check (public.is_admin());

drop policy if exists "admin update ad-free" on public.ad_free_emails;
create policy "admin update ad-free" on public.ad_free_emails
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete ad-free" on public.ad_free_emails;
create policy "admin delete ad-free" on public.ad_free_emails
  for delete using (public.is_admin());
