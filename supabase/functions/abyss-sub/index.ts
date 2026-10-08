// Supabase Edge Function: abyss-sub
//
// Secure bridge between the AniLanka admin panel and the abyss.to subtitle API.
//
// The browser never sees the abyss.to credentials or the abyss JWT.
//
// Accounts come from the `abyss_accounts` table (managed in the admin
// Subtitles tab). Uploads rotate: the least recently used active account is
// tried first, and any account that fails - sign-in, expired token, or a
// rejected upload - is skipped in favour of the next one. The single account
// in this function's environment is kept as a final fallback, so uploads keep
// working while no database account has been added yet.
//
//   ABYSS_EMAIL     abyss.to account email      (optional fallback)
//   ABYSS_PASSWORD  abyss.to account password   (optional fallback)
//   ADMIN_EMAILS    comma-separated allow-list  (optional, recommended)
//   ABYSS_API_KEY   abyss.to api key            (optional read fallback)
//
// SUPABASE_SERVICE_ROLE_KEY is injected by Supabase and is used for one thing
// only: reading/updating the abyss_accounts table, which RLS closes to every
// client because it holds recoverable passwords.
//
// Request (POST, JSON):
//   { fileId: string, language: "Sinhala" | "English", filename?: string, content: string }
//   { action: "test", accountId?: number }   - admin panel verifies sign-in
//   Authorization: Bearer <supabase access token>
//
// Response:
//   { success: true,  message: "Sinhala subtitle uploaded successfully via …" }
//   { success: false, error:   "...", detail?: "account: reason; …" }
//
// The abyss video id at the end of an embed URL IS the subtitle API file id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/**
 * Bumped whenever the request/response contract changes.
 *
 * Every reply carries it, and the admin panel refuses to trust a reply without
 * it. That is deliberate: an older deployment of this function (the single
 * ABYSS_EMAIL revision) answers with a bare "Failed to upload subtitle to
 * Abyss." that looks like an account problem but is really a stale deployment.
 * Without a marker, that is impossible to tell apart from a real failure.
 */
const FUNCTION_VERSION = 2;

const ABYSS_API_BASE = "https://api.abyss.to";
const ALLOWED_LANGUAGES = ["Sinhala", "English"] as const;
type Language = (typeof ALLOWED_LANGUAGES)[number];
const FILE_ID_RE = /^[A-Za-z0-9_-]{7,17}$/;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  // Stamp the version onto every object reply (never onto an array).
  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? { version: FUNCTION_VERSION, ...(body as Record<string, unknown>) }
      : body;
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function fail(error: string, status = 400): Response {
  return json({ success: false, error }, status);
}

/* ------------------------------------------------------------------ */
/* VTT -> SRT                                                          */
/* ------------------------------------------------------------------ */

/** "HH:MM:SS.mmm" or "MM:SS.mmm" -> "HH:MM:SS,mmm" */
function toSrtTimestamp(input: string): string | null {
  const m = input
    .trim()
    .replace(",", ".")
    .match(/^(?:(\d+):)?(\d{1,2}):(\d{2})\.(\d{1,3})$/);
  if (!m) return null;
  const h = (m[1] ?? "0").padStart(2, "0");
  const min = m[2].padStart(2, "0");
  const sec = m[3].padStart(2, "0");
  const ms = m[4].padEnd(3, "0").slice(0, 3);
  return `${h}:${min}:${sec},${ms}`;
}

/**
 * Converts a WebVTT file to SubRip. Preserves cue order, timing, text,
 * multiline cues and Unicode/Sinhala characters. Cue identifiers are dropped
 * (SRT uses sequential numbering) and cue settings are stripped.
 */
export function vttToSrt(input: string): string {
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  const cues: string[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.replace(/\s+$/, ""));
    const head = (lines[0] ?? "").trim();
    if (/^(NOTE|STYLE|REGION)\b/i.test(head)) continue;
    if (/^WEBVTT/i.test(head) && !block.includes("-->")) continue;

    const timingIdx = lines.findIndex((l) => l.includes("-->"));
    if (timingIdx < 0) continue;

    const timing = lines[timingIdx].trim();
    const arrow = timing.indexOf("-->");
    const rawStart = timing.slice(0, arrow);
    // everything after the end timestamp (cue settings, e.g. "align:start") is dropped
    const rawEnd = timing.slice(arrow + 3).trim().split(/\s+/)[0];

    const start = toSrtTimestamp(rawStart);
    const end = toSrtTimestamp(rawEnd);
    if (!start || !end) continue;

    const text = lines.slice(timingIdx + 1).join("\n").replace(/\s+$/, "");
    cues.push(`${cues.length + 1}\n${start} --> ${end}\n${text}`);
  }

  return cues.length ? `${cues.join("\n\n")}\n` : "";
}

/** Accepts WebVTT or SubRip text and always returns SubRip, or null on failure. */
export function textToSrt(input: string): string | null {
  const clean = input.replace(/^\uFEFF/, "");
  if (/^WEBVTT/i.test(clean.trimStart())) {
    const out = vttToSrt(clean);
    return out.trim() ? out : null;
  }
  if (/\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(clean)) {
    // already SubRip — just normalise line endings and decimal separators
    return (
      clean
        .replace(/\r\n?/g, "\n")
        .replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, "$1,$2")
        .trimEnd() + "\n"
    );
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* abyss.to accounts (database pool, secrets as fallback)              */
/* ------------------------------------------------------------------ */

interface AbyssAccount {
  /** Row id, or null for the single-account secrets fallback. */
  id: number | null;
  label: string;
  username: string;
  password: string;
}

/** Service-role client. Used only for the abyss_accounts table. */
function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Active accounts, least recently used first.
 *
 * last_used_at is stamped on every attempt (success or failure), so a working
 * account moves to the back of the queue and the pool rotates instead of one
 * account carrying every upload.
 */
async function listAbyssAccounts(): Promise<AbyssAccount[]> {
  const sb = serviceClient();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("abyss_accounts")
      .select("id, label, username, password, last_used_at")
      .eq("is_active", true)
      .order("last_used_at", { ascending: true, nullsFirst: true })
      .order("id", { ascending: true });
    if (error) {
      console.error("abyss-sub could not read abyss_accounts", error.message);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[])
      .map((row) => ({
        id: Number(row.id),
        label: String(row.label ?? "").trim() || String(row.username ?? "").trim(),
        username: String(row.username ?? "").trim(),
        password: String(row.password ?? ""),
      }))
      .filter((a) => a.username !== "" && a.password !== "");
  } catch (e) {
    console.error("abyss-sub could not read abyss_accounts", e);
    return [];
  }
}

/** The old single-account secrets, used only when no account works. */
function secretsAccount(): AbyssAccount | null {
  const username = (Deno.env.get("ABYSS_EMAIL") ?? "").trim();
  const password = Deno.env.get("ABYSS_PASSWORD") ?? "";
  if (!username || !password) return null;
  return { id: null, label: "ABYSS_EMAIL secret", username, password };
}

/** Bearer tokens are cached per account; abyss tokens last about an hour. */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Which account last accepted an upload for a file id.
 *
 * A subtitle can only be attached by the account that owns the video, so for a
 * video that belongs to a later candidate the earlier accounts are guaranteed
 * to fail. Remembering the one that worked sends a retry straight to the right
 * account, and stops wrong-account attempts from churning the rotation.
 *
 * Best effort: per function instance, oldest entries dropped.
 */
const fileOwners = new Map<string, string>();
const FILE_OWNER_LIMIT = 500;

function rememberOwner(fileId: string, account: AbyssAccount): void {
  fileOwners.delete(fileId);
  fileOwners.set(fileId, tokenKey(account));
  while (fileOwners.size > FILE_OWNER_LIMIT) {
    const oldest = fileOwners.keys().next().value;
    if (oldest === undefined) break;
    fileOwners.delete(oldest);
  }
}

/** Moves the account that already worked for this file id to the front. */
function ownerFirst(candidates: AbyssAccount[], fileId: string): AbyssAccount[] {
  const preferred = fileOwners.get(fileId);
  const index = preferred
    ? candidates.findIndex((a) => tokenKey(a) === preferred)
    : -1;
  if (index <= 0) return candidates;
  return [candidates[index], ...candidates.slice(0, index), ...candidates.slice(index + 1)];
}

function tokenKey(account: AbyssAccount): string {
  return account.id === null ? "env" : `db:${account.id}`;
}

/** Logs in to abyss.to and returns the token plus its lifetime. */
async function loginAbyss(
  username: string,
  password: string
): Promise<{ token: string; ttlMs: number } | null> {
  let res: Response;
  try {
    res = await fetch(`${ABYSS_API_BASE}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: username, password }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as
    | { token?: string; expiresIn?: number }
    | null;
  const token = data?.token;
  if (!token || typeof token !== "string") return null;

  // Abyss tokens are valid for ~1h; refresh a minute early when possible.
  let ttlMs = 50 * 60 * 1000;
  const exp = Number(data?.expiresIn);
  if (Number.isFinite(exp) && exp > 0) {
    ttlMs = exp > 100000 ? exp : exp * 1000; // seconds vs milliseconds
    ttlMs = Math.max(60_000, ttlMs - 60_000);
  }
  return { token, ttlMs };
}

/** Cached token for one account, logging in when missing or expired. */
async function tokenForAccount(
  account: AbyssAccount,
  force = false
): Promise<string | null> {
  const key = tokenKey(account);
  const hit = tokenCache.get(key);
  if (!force && hit && Date.now() < hit.expiresAt) return hit.token;

  const fresh = await loginAbyss(account.username, account.password);
  if (!fresh) {
    tokenCache.delete(key);
    return null;
  }
  tokenCache.set(key, {
    token: fresh.token,
    expiresAt: Date.now() + fresh.ttlMs,
  });
  return fresh.token;
}

/** Records an attempt so the admin panel can show stale accounts. */
async function markAccount(
  id: number | null,
  ok: boolean,
  error: string | null
): Promise<void> {
  if (id === null) return;
  const sb = serviceClient();
  if (!sb) return;
  try {
    await sb.rpc("abyss_account_mark", { p_id: id, p_ok: ok, p_error: error });
  } catch (e) {
    // Tracking is best effort - never fail an upload over it.
    console.error("abyss-sub could not record the account attempt", e);
  }
}

interface AbyssSubtitle {
  id?: string;
  name?: string;
  filename?: string;
  language?: string;
  lang?: string;
  label?: string;
  slug?: string;
  type?: string;
}

interface ListResult {
  ok: boolean;
  status?: number;
  error?: string;
  items: AbyssSubtitle[];
}

async function listAbyssSubtitles(fileId: string, token: string | null): Promise<ListResult> {
  const apiKey = (Deno.env.get("ABYSS_API_KEY") ?? "").trim();

  const call = (qs: string, bearer: string | null) => {
    const headers: Record<string, string> = {};
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    return fetch(
      `${ABYSS_API_BASE}/v1/subtitles/${encodeURIComponent(fileId)}/list${qs}`,
      { headers }
    );
  };

  try {
    let res = await call(token ? "" : apiKey ? `?key=${encodeURIComponent(apiKey)}` : "", token);
    // The api key can read even when the Bearer token is rejected.
    if ((res.status === 401 || res.status === 403) && apiKey) {
      res = await call(`?key=${encodeURIComponent(apiKey)}`, null);
    }

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const message =
        parsed && typeof parsed === "object" && "message" in parsed
          ? String((parsed as { message?: unknown }).message ?? "")
          : "";
      return { ok: false, status: res.status, error: message || `Abyss returned ${res.status}`, items: [] };
    }
    const obj = parsed as { items?: AbyssSubtitle[] } | AbyssSubtitle[] | null;
    const items = Array.isArray(obj) ? obj : Array.isArray(obj?.items) ? obj!.items! : [];
    return { ok: true, items };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error", items: [] };
  }
}

/** True when a listed subtitle belongs to the requested language. */
function matchesLanguage(sub: AbyssSubtitle, language: Language): boolean {
  const hay = [sub.language, sub.lang, sub.label, sub.name, sub.filename, sub.slug, sub.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!hay) return false;
  if (hay.includes(language.toLowerCase())) return true;
  if (language === "Sinhala" && /\b(si|sin|sinhala)\b/.test(hay)) return true;
  if (language === "English" && /\b(en|eng|english)\b/.test(hay)) return true;
  return false;
}

async function deleteAbyssSubtitle(subtitleId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${ABYSS_API_BASE}/v1/subtitles/${encodeURIComponent(subtitleId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    return res.ok;
  } catch {
    return false;
  }
}

interface UploadResult {
  ok: boolean;
  status?: number;
}

async function uploadAbyssSubtitle(
  fileId: string,
  language: Language,
  srt: string,
  token: string
): Promise<UploadResult> {
  const filename = language === "Sinhala" ? "sinhala.srt" : "english.srt";
  const url =
    `${ABYSS_API_BASE}/v1/upload/subtitles/${encodeURIComponent(fileId)}` +
    `?language=${encodeURIComponent(language)}&filename=${encodeURIComponent(filename)}`;
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/octet-stream",
      },
      body: srt,
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  }
}

/**
 * One complete attempt with a single account: clear any existing subtitle for
 * this language, then upload. Returns a readable reason when it fails, so the
 * response can explain which accounts were tried and why they did not work.
 */
async function attemptSubtitleUpload(
  account: AbyssAccount,
  fileId: string,
  language: Language,
  srt: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let token = await tokenForAccount(account);
  if (!token) return { ok: false, reason: "could not sign in to abyss.to" };

  // Remove any existing subtitle for this language (never touches the other).
  try {
    const listed = await listAbyssSubtitles(fileId, token);
    if (listed.ok) {
      for (const sub of listed.items) {
        if (sub?.id && matchesLanguage(sub, language)) {
          await deleteAbyssSubtitle(String(sub.id), token);
        }
      }
    }
  } catch (e) {
    console.error("abyss-sub list/delete failed", e);
  }

  const uploaded = await uploadAbyssSubtitle(fileId, language, srt, token);

  // An expired or revoked token is the usual failure. Get a fresh one and try
  // this account once more before moving on to the next.
  if (!uploaded.ok && (uploaded.status === 401 || uploaded.status === 403)) {
    token = await tokenForAccount(account, true);
    if (!token) return { ok: false, reason: "could not sign in to abyss.to" };
    const retry = await uploadAbyssSubtitle(fileId, language, srt, token);
    if (retry.ok) return { ok: true };
    return {
      ok: false,
      reason: `abyss.to rejected the upload (${retry.status ?? "network error"})`,
    };
  }

  if (uploaded.ok) return { ok: true };
  return {
    ok: false,
    reason: uploaded.status ? `abyss.to returned ${uploaded.status}` : "network error",
  };
}

/**
 * Sign-in check for the admin panel's "Test" button. Never uploads anything.
 * With no database accounts it falls back to the ABYSS_EMAIL secret.
 */
async function testAccounts(accountId: unknown): Promise<Response> {
  const only = accountId === undefined || accountId === null ? null : Number(accountId);

  let accounts = await listAbyssAccounts();
  if (accounts.length === 0) {
    const fallback = secretsAccount();
    accounts = fallback ? [fallback] : [];
  }
  if (only !== null) accounts = accounts.filter((a) => a.id === only);

  const results: { id: number | null; label: string; ok: boolean; error: string | null }[] = [];
  for (const account of accounts) {
    const token = await tokenForAccount(account, true);
    const error = token ? null : "could not sign in to abyss.to";
    if (!token) await markAccount(account.id, false, error);
    results.push({ id: account.id, label: account.label, ok: Boolean(token), error });
  }
  return json({ success: true, results });
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("Only POST requests are supported.", 405);

  // 1. Verify the Supabase authentication token (never trust a client email).
  const authHeader = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(authHeader)) {
    return fail("You are not authorized to upload subtitles.", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return fail("Server is not configured.", 500);

  const sb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await sb.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return fail("You are not authorized to upload subtitles.", 401);

  // 2. Authorize: ADMIN_EMAILS allow-list, plus the app's own admin/staff roles.
  const email = (user.email ?? "").trim().toLowerCase();
  const adminEmails = (Deno.env.get("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  let authorized = adminEmails.length > 0 && email !== "" && adminEmails.includes(email);
  if (!authorized) {
    const { data: profile } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile as { role?: string } | null)?.role;
    authorized = role === "admin" || role === "staff";
  }
  if (!authorized) return fail("You are not authorized to upload subtitles.", 403);

  // 3. Validate the request body.
  let body:
    | {
        fileId?: unknown;
        language?: unknown;
        content?: unknown;
        action?: unknown;
        accountId?: unknown;
      }
    | null = null;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  // 3a. The admin panel can ask which accounts still work (never uploads).
  if (String(body?.action ?? "") === "test") {
    return await testAccounts(body?.accountId);
  }

  const fileId = String(body?.fileId ?? "").trim();
  const language = String(body?.language ?? "").trim();
  const content = typeof body?.content === "string" ? body.content : "";

  if (!fileId) return fail("Could not detect the Abyss video ID from this URL.", 400);
  if (!FILE_ID_RE.test(fileId)) return fail("Invalid Abyss video URL.", 400);
  if (!ALLOWED_LANGUAGES.includes(language as Language)) {
    return fail("Only Sinhala and English subtitles are supported.", 400);
  }
  if (!content.trim()) return fail("The subtitle file is empty.", 400);

  // 4. VTT -> SRT.
  const srt = textToSrt(content);
  if (!srt) return fail("Could not convert the subtitle file to SRT.", 400);

  // 5. Try each account in turn until one accepts the upload: least recently
  //    used first, with the single-account secrets as the last resort.
  const candidates = await listAbyssAccounts();
  const fallback = secretsAccount();
  if (fallback) candidates.push(fallback);

  if (candidates.length === 0) {
    return fail(
      "No abyss account is configured. Add one in the admin Subtitles tab, or set " +
        "the ABYSS_EMAIL and ABYSS_PASSWORD secrets.",
      502
    );
  }

  // 6. Attempt the upload through each account until one succeeds, recording
  //    every outcome so the admin panel can show which account has gone stale.
  //    The account that accepted this file before goes first: only the owner of
  //    the video can attach a subtitle to it, so that is where it will work.
  const failures: string[] = [];
  const ordered = ownerFirst(candidates, fileId);

  for (const account of ordered) {
    const attempt = await attemptSubtitleUpload(account, fileId, language as Language, srt);

    if (attempt.ok) {
      rememberOwner(fileId, account);
      await markAccount(account.id, true, null);
      return json({
        success: true,
        message: `${language} subtitle uploaded successfully${
          account.id === null ? "" : ` via ${account.label}`
        }.`,
        account: account.id === null ? null : { id: account.id, label: account.label },
      });
    }

    failures.push(`${account.label}: ${attempt.reason}`);
    console.error("abyss-sub attempt failed", account.label, attempt.reason);
    await markAccount(account.id, false, attempt.reason);
  }

  // Every account failed - report which ones were tried and why, rather than
  // a bare "upload failed" that leaves the admin guessing which account is bad.
  return json(
    {
      success: false,
      error: `Failed to upload the subtitle to Abyss. Tried ${failures.length} account${
        failures.length === 1 ? "" : "s"
      }.`,
      detail: failures.join("; "),
    },
    502
  );
});
