import { createClient } from "@supabase/supabase-js";
import { isStaffRequest } from "@/lib/admin-auth";
import {
  getTmdbEnvCredentials,
  hasCredential,
  searchTmdb,
  tmdbImages,
  TmdbError,
  type TmdbCredentials,
} from "@/lib/tmdb";

export const dynamic = "force-dynamic";

async function getSettingsCredentials(): Promise<TmdbCredentials | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const sb = createClient(url, anon);
    const { data } = await sb
      .from("settings")
      .select("value")
      .eq("key", "tmdb_api")
      .single();
    const cfg = (data as { value?: { api_key?: string; access_token?: string } } | null)?.value;
    if (!cfg) return null;
    return {
      apiKey: cfg.api_key || null,
      accessToken: cfg.access_token || null,
    };
  } catch {
    return null;
  }
}

async function resolveCredentials(): Promise<TmdbCredentials | null> {
  const env = getTmdbEnvCredentials();
  if (hasCredential(env)) return env;
  const settings = await getSettingsCredentials();
  return hasCredential(settings) ? settings : null;
}

function errorResponse(kind: string, status: number) {
  const messages: Record<string, string> = {
    "missing-config": "TMDB API configuration is missing. Please configure the server credentials.",
    auth: "TMDB API rejected the credentials. Check the server configuration.",
    "rate-limited": "TMDB rate limit reached. Please try again shortly.",
    network: "Unable to connect to TMDB. Please try again.",
    api: "TMDB returned an error. Please try again.",
  };
  return Response.json({ ok: false, error: messages[kind] ?? messages.api }, { status });
}

export async function GET(request: Request) {
  if (!(await isStaffRequest(request))) {
    return Response.json({ ok: false, error: "Staff login required" }, { status: 401 });
  }

  const creds = await resolveCredentials();
  if (!creds) {
    return errorResponse("missing-config", 503);
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "search") {
      const q = (url.searchParams.get("q") || "").trim();
      const mediaType = url.searchParams.get("type") === "movie" ? "movie" : "tv";
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      if (q.length < 2) {
        return Response.json({ ok: false, error: "Enter at least 2 characters to search." }, { status: 400 });
      }
      const result = await searchTmdb(q, mediaType, page, creds);
      return Response.json({ ok: true, data: result });
    }

    if (action === "images") {
      const mediaType = url.searchParams.get("type") === "movie" ? "movie" : "tv";
      const id = Number(url.searchParams.get("id"));
      if (!id) {
        return Response.json({ ok: false, error: "Missing TMDB id" }, { status: 400 });
      }
      const result = await tmdbImages(mediaType, id, creds);
      return Response.json({ ok: true, data: result });
    }

    return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof TmdbError) {
      const status =
        e.kind === "missing-config" ? 503 : e.kind === "rate-limited" ? 429 : e.kind === "auth" ? 502 : 502;
      return errorResponse(e.kind, status);
    }
    return errorResponse("api", 502);
  }
}
