# `abyss-sub` Edge Function

Secure bridge between the AniLanka admin panel and the **abyss.to** subtitle
API. The browser never receives the abyss.to credentials or the abyss JWT.

Accounts live in the `abyss_accounts` table (admin **Subtitles → Abyss
Accounts**) and uploads rotate through them; the single account in the function
secrets is kept as a fallback.

```
Admin Panel (browser)
   │  Supabase access token + fileId + language + subtitle text
   ▼
abyss-sub  (verifies admin, VTT→SRT, picks an account, lists/deletes/uploads)
   │  service role → abyss_accounts     (rotation + attempt tracking)
   │  ABYSS_EMAIL / ABYSS_PASSWORD      (fallback while the table is empty)
   ▼
api.abyss.to  →  Abyss player (CC → Sinhala / English)
```

## The key idea

The **last path segment of an Abyss embed URL is the file ID** used by the
subtitle API:

```
https://player.abyssplayer.com/Y3rXZpZoP   →   fileId = "Y3rXZpZoP"
```

The admin panel extracts it automatically — it is never typed in or generated
separately.

## Accounts

Subtitle uploads used to depend on one account in the function secrets. They
now rotate through a pool of accounts stored in the database:

- Table: `public.abyss_accounts`, created by
  [`supabase/migrations/0010_abyss_accounts.sql`](../../migrations/0010_abyss_accounts.sql).
- Managed in **Admin → Subtitles → Abyss Accounts**: add, edit, enable/disable,
  remove, and a **Test** button that verifies an account can sign in.
- The function reads the table with the **service role**. RLS (no policies) plus
  revoked grants keep it — and therefore the passwords — unreachable from any
  browser. Passwords are never returned even to admins.
- Selection is **least recently used first**: each attempt stamps `last_used_at`,
  so uploads spread across the pool instead of hammering one account. A failure
  (sign-in refused, expired token, rejected upload) moves on to the next
  account, and the outcome is recorded as `last_error` / `failure_count` so the
  panel can flag stale accounts.

If the table has no active account, or every account fails, the function falls
back to the `ABYSS_EMAIL` / `ABYSS_PASSWORD` secrets.

## Secrets

Only needed as a fallback once accounts exist in the database. They are
**never** committed to git or exposed to the browser:

```bash
supabase secrets set \
  ABYSS_EMAIL=you@example.com \
  ABYSS_PASSWORD=your-password \
  ADMIN_EMAILS=you@example.com,partner@example.com
```

| Secret           | Required | Purpose                                                        |
| ---------------- | -------- | -------------------------------------------------------------- |
| `ABYSS_EMAIL`    | fallback | abyss.to account email (used for `POST /auth/login`)           |
| `ABYSS_PASSWORD` | fallback | abyss.to account password                                      |
| `ADMIN_EMAILS`   | no       | comma-separated allow-list of admin emails                     |
| `ABYSS_API_KEY`  | no       | abyss api key, used as a read fallback for the list endpoint   |

`SUPABASE_SERVICE_ROLE_KEY` is injected into every Edge Function by Supabase —
do not set it yourself. It is used only to read and update `abyss_accounts`.

Authorization accepts a caller whose verified email is in `ADMIN_EMAILS`
**or** whose `profiles.role` is `admin` / `staff` (the app's own roles), so
staff uploaders keep working. The email always comes from the verified
Supabase token — a client-supplied email is never trusted.

## Deploy

```bash
# from the repo root, once per project
supabase link --project-ref <your-project-ref>

# deploy this function
supabase functions deploy abyss-sub
```

### An out-of-date deployment looks like a broken account — it is not

Editing `index.ts` here changes nothing until it is deployed. That matters a
lot for this function, because the **first** revision uploaded as the single
`ABYSS_EMAIL` account only. Attaching a subtitle to a video that belongs to a
different account therefore failed with a bare
`"Failed to upload subtitle to Abyss."` — which reads like an account problem
and sends you checking passwords that are fine.

Every reply now carries `version` (`FUNCTION_VERSION` at the top of `index.ts`,
currently **2**), and `src/lib/abyss-sub.ts` will not trust a reply without it.
If the deployed function is older, the admin panel says so instead:

> The deployed abyss-sub Edge Function is an older revision: it only signs in
> with the single ABYSS_EMAIL account and never reads the accounts in Subtitles →
> Abyss Accounts, so a video that belongs to another account cannot be given
> subtitles. Deploy the current function (supabase functions deploy abyss-sub)
> and try again.

The same check covers the **Test** button: an old revision answers a health
check with a misleading `"Invalid Abyss video URL."`, so the panel reports the
stale deployment instead.

No CLI? Paste `supabase/functions/abyss-sub/index.ts` into **Edge Functions →
abyss-sub → Edit** in the dashboard and deploy from there.

Bump `FUNCTION_VERSION` whenever the request or response shape changes, and
keep the constant of the same name in `src/lib/abyss-sub.ts` in step.

The function runs with JWT verification on by default, so the frontend must
send the signed-in user's Supabase access token (it does — see
`src/lib/abyss-sub.ts`).

## Request / response

Request (`POST`, JSON, `Authorization: Bearer <supabase access token>`):

```json
{
  "fileId": "Y3rXZpZoP",
  "language": "Sinhala",
  "filename": "my subs.vtt",
  "content": "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n..."
}
```

Success (the message names the account that was used):

```json
{ "success": true, "message": "Sinhala subtitle uploaded successfully via Main account." }
```

Failure (every account that was tried, and why each one failed):

```json
{
  "success": false,
  "error": "Failed to upload the subtitle to Abyss. Tried 2 accounts.",
  "detail": "Main account: abyss.to returned 403; Backup: could not sign in to abyss.to"
}
```

Health check, to find accounts whose password has gone stale:

```json
{ "action": "test", "accountId": 3 }
```

`accountId` is optional — omit it to check every active account (and the secrets
fallback when there are none):

```json
{
  "success": true,
  "results": [
    { "id": 3, "label": "Main account", "ok": true, "error": null },
    { "id": 4, "label": "Backup", "ok": false, "error": "could not sign in to abyss.to" }
  ]
}
```

## What it does

1. Verifies the Supabase JWT and resolves the caller's email server-side.
2. Rejects anyone who is not an admin (via `ADMIN_EMAILS` or the app roles).
3. Validates `fileId` (`^[A-Za-z0-9_-]{7,17}$`) and `language` (Sinhala / English only).
4. Converts the uploaded **VTT → SRT** (real conversion — numbering, timestamps,
   multiline cues, Unicode/Sinhala preserved).
5. Loads the active accounts (least recently used first) and signs in to
   abyss.to, caching one JWT per account in memory (~1h), refreshed once on a
   401/403 before that account is abandoned.
6. Lists existing subtitles and **deletes only the matching language** so the
   other language survives and no duplicate is created.

   Only the account that owns the video can attach a subtitle to it, so the
   function remembers which account accepted a file id and tries that one first
   on later uploads (per instance, capped) — a retry does not have to fail over
   again, and wrong-account attempts stop churning the rotation.
7. Uploads `sinhala.srt` / `english.srt` via
   `PUT /v1/upload/subtitles/{fileId}?language=&filename=` with the Bearer token.
8. On failure, records the reason and tries the next account; if none succeeds
   the response lists every account that was attempted.

Both the **Deploy Episode** flow and the **Update Subtitle** flow call this same
function, so a failed subtitle upload can always be retried later without
re-saving the episode.
