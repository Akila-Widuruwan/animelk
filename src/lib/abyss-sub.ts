import { supabaseBrowser } from "./supabase-browser";

/**
 * Browser-side helper for the secure `abyss-sub` Supabase Edge Function.
 *
 * The browser only ever sends its Supabase session token + the abyss file id +
 * the subtitle text. The abyss.to credentials and JWT stay inside the function.
 */

export type AbyssSubtitleLanguage = "Sinhala" | "English";

export const ABYSS_SUB_FUNCTION = "abyss-sub";

export interface AbyssUploadResult {
  ok: boolean;
  message?: string;
  error?: string;
}

export async function pushSubtitleToAbyss(opts: {
  fileId: string;
  language: AbyssSubtitleLanguage;
  file: File;
}): Promise<AbyssUploadResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const sb = supabaseBrowser();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return { ok: false, error: "Sign in as an admin to upload subtitles." };
  }

  let content: string;
  try {
    content = await opts.file.text();
  } catch {
    return { ok: false, error: "Could not read the subtitle file." };
  }
  if (!content.trim()) {
    return { ok: false, error: "The subtitle file is empty." };
  }

  try {
    const res = await fetch(`${url}/functions/v1/${ABYSS_SUB_FUNCTION}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify({
        fileId: opts.fileId,
        language: opts.language,
        filename: opts.file.name,
        content,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const data2 = (await res.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string }
      | null;

    if (res.ok && data2?.success) {
      return { ok: true, message: data2.message };
    }
    if (data2?.error) return { ok: false, error: data2.error };
    if (res.status === 404) {
      return {
        ok: false,
        error: "The abyss-sub Edge Function is not deployed for this Supabase project.",
      };
    }
    return { ok: false, error: `Abyss upload failed (HTTP ${res.status}).` };
  } catch (e) {
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
      return {
        ok: false,
        error: "The abyss-sub Edge Function did not respond — is it deployed?",
      };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
