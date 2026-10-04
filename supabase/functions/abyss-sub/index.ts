// Supabase Edge Function: abyss-sub
//
// Secure bridge between the ANIMELK admin panel and the abyss.to subtitle API.
//
// The browser never sees the abyss.to credentials or the abyss JWT — they live
// only in this function's environment (Supabase Edge Function secrets):
//
//   ABYSS_EMAIL     abyss.to account email      (required)
//   ABYSS_PASSWORD  abyss.to account password   (required)
//   ADMIN_EMAILS    comma-separated allow-list  (optional, recommended)
//   ABYSS_API_KEY   abyss.to api key            (optional read fallback)
//
// Request (POST, JSON):
//   { fileId: string, language: "Sinhala" | "English", filename?: string, content: string }
//   Authorization: Bearer <supabase access token>
//
// Response:
//   { success: true,  message: "Sinhala subtitle uploaded successfully." }
//   { success: false, error:   "..." }
//
// The abyss video id at the end of an embed URL IS the subtitle API file id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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
  return new Response(JSON.stringify(body), {
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
/* abyss.to client (token cache)                                       */
/* ------------------------------------------------------------------ */

let abyssToken: string | null = null;
let abyssTokenExpiresAt = 0;

/** Returns a cached abyss Bearer token, logging in when needed/expired. */
async function getAbyssToken(): Promise<string | null> {
  if (abyssToken && Date.now() < abyssTokenExpiresAt) return abyssToken;

  const email = Deno.env.get("ABYSS_EMAIL");
  const password = Deno.env.get("ABYSS_PASSWORD");
  if (!email || !password) return null;

  let res: Response;
  try {
    res = await fetch(`${ABYSS_API_BASE}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
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
  abyssToken = token;
  abyssTokenExpiresAt = Date.now() + ttlMs;
  return token;
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
  let body: { fileId?: unknown; language?: unknown; content?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.", 400);
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

  // 5. Authenticate with abyss.to.
  const token = await getAbyssToken();
  if (!token) return fail("Could not authenticate with Abyss.", 502);

  // 6. Remove any existing subtitle for this language (never touches the other).
  try {
    const listed = await listAbyssSubtitles(fileId, token);
    if (listed.ok) {
      for (const sub of listed.items) {
        if (sub?.id && matchesLanguage(sub, language as Language)) {
          await deleteAbyssSubtitle(String(sub.id), token);
        }
      }
    }
  } catch (e) {
    console.error("abyss-sub list/delete failed", e);
  }

  // 7. Upload the converted SRT.
  const uploaded = await uploadAbyssSubtitle(fileId, language as Language, srt, token);
  if (!uploaded.ok) {
    console.error("abyss-sub upload failed", uploaded.status);
    return fail("Failed to upload subtitle to Abyss.", 502);
  }

  return json({
    success: true,
    message: `${language} subtitle uploaded successfully.`,
  });
});
