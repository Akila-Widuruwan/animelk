import { supabaseBrowser } from "./supabase-browser";

/**
 * Browser-side helper for the secure `abyss-sub` Supabase Edge Function.
 *
 * The browser only ever sends its Supabase session token + the arguments. The
 * abyss.to credentials, the account pool and the abyss JWTs all stay inside the
 * function; the accounts table cannot be read from the browser at all.
 */

export type AbyssSubtitleLanguage = "Sinhala" | "English";

export const ABYSS_SUB_FUNCTION = "abyss-sub";

/**
 * The `version` a current deployment of the function reports on every reply.
 *
 * An earlier revision (the single ABYSS_EMAIL one) sends no version at all, and
 * its failures read like real account problems — "Failed to upload subtitle to
 * Abyss." — while the real cause is that it never looks at the account pool.
 * Detecting that here means a stale deployment says so, instead of sending you
 * hunting for an account that is actually fine.
 */
const REQUIRED_FUNCTION_VERSION = 2;

const STALE_FUNCTION_HELP =
  "The deployed abyss-sub Edge Function is an older revision: it only signs in with " +
  "the single ABYSS_EMAIL account and never reads the accounts in Subtitles → Abyss " +
  "Accounts, so a video that belongs to another account cannot be given subtitles. " +
  "Deploy the current function (supabase functions deploy abyss-sub) and try again.";

export interface AbyssUploadResult {
  ok: boolean;
  message?: string;
  error?: string;
}

export interface AbyssAccountHealth {
  /** Row id, or null for the single-account ABYSS_EMAIL fallback. */
  id: number | null;
  label: string;
  ok: boolean;
  error: string | null;
}

type CallResult =
  | { ok: true; json: Record<string, unknown> }
  /** `stale` is true when the reply came from a deployment without a version. */
  | { ok: false; error: string; stale: boolean };

/** One place for the endpoint, the auth header and the error mapping. */
async function callAbyssSub(
  body: Record<string, unknown>,
  opts: { timeoutMs: number; notSignedIn: string }
): Promise<CallResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, error: "Supabase is not configured.", stale: false };
  }

  const sb = supabaseBrowser();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return { ok: false, error: opts.notSignedIn, stale: false };
  }

  try {
    const res = await fetch(`${url}/functions/v1/${ABYSS_SUB_FUNCTION}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    // A current deployment stamps every reply with a version; an older one does not.
    const version = Number(json?.version ?? 0);
    const stale = json !== null && !(version >= REQUIRED_FUNCTION_VERSION);

    if (res.ok && json?.success === true) {
      return { ok: true, json };
    }
    if (typeof json?.error === "string" && json.error) {
      // `detail` explains which accounts were tried and why each failed.
      const detail = typeof json.detail === "string" && json.detail ? ` — ${json.detail}` : "";
      return { ok: false, error: `${json.error}${detail}`, stale };
    }
    if (res.status === 404) {
      return {
        ok: false,
        error:
          "The abyss-sub Edge Function is not deployed for this Supabase project.",
        stale: false,
      };
    }
    return { ok: false, error: `Abyss request failed (HTTP ${res.status}).`, stale };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return {
        ok: false,
        error: "The abyss-sub Edge Function did not respond — is it deployed?",
        stale: false,
      };
    }
    // A cross-origin fetch failure surfaces as a bare "Failed to fetch"
    // (usually a missing function or a rejected CORS preflight).
    const message = e instanceof Error ? e.message : "";
    if (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(message)) {
      return {
        ok: false,
        error:
          "Could not reach the abyss-sub Edge Function. Deploy it in your Supabase " +
          "project (Edge Functions -> abyss-sub), then try again.",
        stale: false,
      };
    }
    return { ok: false, error: message || "Network error", stale: false };
  }
}

export async function pushSubtitleToAbyss(opts: {
  fileId: string;
  language: AbyssSubtitleLanguage;
  file: File;
}): Promise<AbyssUploadResult> {
  let content: string;
  try {
    content = await opts.file.text();
  } catch {
    return { ok: false, error: "Could not read the subtitle file." };
  }
  if (!content.trim()) {
    return { ok: false, error: "The subtitle file is empty." };
  }

  const result = await callAbyssSub(
    {
      fileId: opts.fileId,
      language: opts.language,
      filename: opts.file.name,
      content,
    },
    { timeoutMs: 60000, notSignedIn: "Sign in as an admin to upload subtitles." }
  );

  if (!result.ok) {
    return {
      ok: false,
      // Name the real cause when the function is simply out of date.
      error: result.stale ? `${STALE_FUNCTION_HELP} Abyss said: ${result.error}` : result.error,
    };
  }
  return {
    ok: true,
    message: typeof result.json.message === "string" ? result.json.message : undefined,
  };
}

/**
 * Asks the function which abyss accounts can still sign in. Pass an id to check
 * one account, or nothing to check every active account at once.
 */
export async function testAbyssAccounts(
  accountId?: number | null
): Promise<{ results: AbyssAccountHealth[] } | { error: string }> {
  const result = await callAbyssSub(
    { action: "test", accountId: accountId ?? null },
    { timeoutMs: 45000, notSignedIn: "Sign in as an admin to test abyss accounts." }
  );

  if (!result.ok) return { error: result.stale ? STALE_FUNCTION_HELP : result.error };

  // An old deployment answers a "test" with a generic complaint about the video
  // ID instead of a results list; say what is really wrong.
  if (!("version" in result.json)) return { error: STALE_FUNCTION_HELP };

  const raw = Array.isArray(result.json.results)
    ? (result.json.results as Record<string, unknown>[])
    : [];

  return {
    results: raw.map((row) => ({
      id: row.id === null || row.id === undefined ? null : Number(row.id),
      label: String(row.label ?? ""),
      ok: row.ok === true,
      error: typeof row.error === "string" ? row.error : null,
    })),
  };
}
