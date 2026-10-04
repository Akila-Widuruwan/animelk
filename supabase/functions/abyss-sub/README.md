# `abyss-sub` Edge Function

Secure bridge between the ANIMELK admin panel and the **abyss.to** subtitle
API. The browser never receives the abyss.to credentials or the abyss JWT —
they live only in this function's secrets.

```
Admin Panel (browser)
   │  Supabase access token + fileId + language + subtitle text
   ▼
abyss-sub  (verifies admin, VTT→SRT, caches abyss JWT, lists/deletes/uploads)
   │  ABYSS_EMAIL / ABYSS_PASSWORD  (secrets)
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

## Secrets

Set these once (they are **never** committed to git or exposed to the browser):

```bash
supabase secrets set \
  ABYSS_EMAIL=you@example.com \
  ABYSS_PASSWORD=your-password \
  ADMIN_EMAILS=you@example.com,partner@example.com
```

| Secret           | Required | Purpose                                                        |
| ---------------- | -------- | -------------------------------------------------------------- |
| `ABYSS_EMAIL`    | yes      | abyss.to account email (used for `POST /auth/login`)           |
| `ABYSS_PASSWORD` | yes      | abyss.to account password                                      |
| `ADMIN_EMAILS`   | no       | comma-separated allow-list of admin emails                     |
| `ABYSS_API_KEY`  | no       | abyss api key, used as a read fallback for the list endpoint   |

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

Success:

```json
{ "success": true, "message": "Sinhala subtitle uploaded successfully." }
```

Failure:

```json
{ "success": false, "error": "Failed to upload subtitle to Abyss." }
```

## What it does

1. Verifies the Supabase JWT and resolves the caller's email server-side.
2. Rejects anyone who is not an admin (via `ADMIN_EMAILS` or the app roles).
3. Validates `fileId` (`^[A-Za-z0-9_-]{7,17}$`) and `language` (Sinhala / English only).
4. Converts the uploaded **VTT → SRT** (real conversion — numbering, timestamps,
   multiline cues, Unicode/Sinhala preserved).
5. Logs in to abyss.to (`POST /auth/login`), caching the JWT in memory (~1h).
6. Lists existing subtitles and **deletes only the matching language** so the
   other language survives and no duplicate is created.
7. Uploads `sinhala.srt` / `english.srt` via
   `PUT /v1/upload/subtitles/{fileId}?language=&filename=` with the Bearer token.

Both the **Deploy Episode** flow and the **Update Subtitle** flow call this same
function, so a failed subtitle upload can always be retried later without
re-saving the episode.
