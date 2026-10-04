# Supabase Setup

The whole site is driven by Supabase. Content, homepage layout, navigation,
site settings, users, watchlists, watch history and ratings all live in the
database. Anime images are NOT uploaded to Supabase storage — the image
columns store external URLs (AniList CDN etc.), but you can put any URL there,
including a future Supabase Storage public URL.

## 1. Create a project

1. Go to https://supabase.com and create a new project.
2. Copy **Project URL** and **anon key** from
   Settings → API.

## 2. Apply the schema

Open the Supabase SQL editor and run
[`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).

For custom subtitles (episode subtitle uploads), also run
[`supabase/migrations/0002_subtitles.sql`](./supabase/migrations/0002_subtitles.sql)
— it adds the `episodes.subtitles` column and creates the public `subtitles`
storage bucket with admin-only upload policies.

For the staff submission workflow, run
[`supabase/migrations/0005_staff.sql`](./supabase/migrations/0005_staff.sql)
— it adds the `staff` role, the `anime` moderation columns, and the RLS rules
that keep unapproved uploads hidden from the public site.

## 3. Seed with your current anime data

The site already ships with 97 anime from AniList. To import them into the
database:

```bash
npm run db:seed        # generates supabase/seed.sql from src/data/anime.json
```

Then run `supabase/seed.sql` in the SQL editor (safe to re-run — it truncates
and re-inserts content tables).

## 4. Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Restart `npm run dev`. The site now reads everything from Supabase.
If the env vars are missing it automatically falls back to the bundled JSON.

## 5. Make yourself an admin

Sign up on the site (or via Auth → Users in the dashboard), then run:

```sql
update public.profiles set role = 'admin' where id = '<your-user-uuid>';
```

Admins get write access to all content tables (enforced by RLS).

## 5b. Add staff (uploaders)

Staff can submit new anime with episodes, TMDB posters/backdrops, and
release dates, but they can never edit or delete anything already live on the
site. Create their account in Supabase Auth, then:

```sql
update public.profiles set role = 'staff' where id = '<their-user-uuid>';
```

Staff sign in at **`/staff`** and submit uploads. Every submission is stored
with `moderation_status = 'pending'` and is invisible on the public site until
the owner approves it under **/admin → Submissions**. Approving publishes it and
drops it into the `new-series`/`new-anime` homepage rows; rejecting attaches a
note the staff member sees on their submission.

## What the database manages

| Table            | What it manages                                             |
| ---------------- | ----------------------------------------------------------- |
| `anime`          | Every anime: metadata, badges, flags, scores, ordering      |
| `genres`         | Genre list                                                  |
| `anime_genres`   | Anime ↔ genre links                                         |
| `episodes`       | Episodes per anime (video URLs, thumbnails, premium flags)  |
| `topics`         | "What are you interested in?" colored tiles                 |
| `sections`       | Homepage rows: title, layout kind, order, visibility        |
| `section_items`  | Which anime appear in each section, in which order          |
| `hero_slides`    | Hero slider contents and order                              |
| `menu_items`     | Navbar links (labels, URLs, badges)                         |
| `settings`       | Site name, footer links, socials (JSONB)                    |
| `profiles`       | Extends auth users (username, avatar, admin role)           |
| `watchlist`      | User watchlists                                             |
| `watch_history`  | Continue-watching / progress                                |
| `ratings`        | User ratings (1–10) and reviews                             |

Layout kinds for `sections.kind`:
`carousel`, `panel`, `top10`, `slider`, `filter`, `topics`, `grid`.

## Adding new anime later

Insert a row into `anime` (leave `banner_image`/`cover_image` as external
URLs), link genres via `anime_genres`, optionally add rows to `episodes`, then
drop it into any `section` via `section_items` or `hero_slides`.
