/**
 * Client-side access to the anime request system.
 *
 * Every write goes through the Supabase RPCs created in
 * `supabase/migrations/0009_anime_requests.sql`, so the request_count is only
 * ever computed server-side. Reads use RLS: `anime_requests` is public, the
 * supports table (messages + supporter keys) is admin-only.
 */

import { supabaseBrowser } from "./supabase-browser";
import type { CatalogAnime } from "./anime-provider";

export type RequestType =
  | "NEW_ANIME"
  | "NEW_SEASON"
  | "MISSING_EPISODE"
  | "DUB"
  | "SUBTITLE"
  | "OTHER";

export type RequestStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "PLANNED"
  | "PROCESSING"
  | "ADDED"
  | "REJECTED";

export interface AnimeRequest {
  id: number;
  source: string;
  external_id: number;
  anime_title: string;
  anime_title_english: string | null;
  anime_title_native: string | null;
  anime_romaji: string | null;
  anime_cover: string | null;
  anime_format: string | null;
  anime_status: string | null;
  anime_episodes: number | null;
  anime_year: number | null;
  season: number;
  season_year: number | null;
  season_label: string | null;
  request_type: RequestType;
  request_count: number;
  status: RequestStatus;
  added_anime_id: number | null;
  first_requested_at: string;
  last_requested_at: string;
  created_at: string;
  updated_at: string;
}

export const REQUEST_FIELDS =
  "id, source, external_id, anime_title, anime_title_english, anime_title_native, anime_romaji, anime_cover, anime_format, anime_status, anime_episodes, anime_year, season, season_year, season_label, request_type, request_count, status, added_anime_id, first_requested_at, last_requested_at, created_at, updated_at";

export const REQUEST_TYPES: {
  id: RequestType;
  label: string;
  hint: string;
}[] = [
  { id: "NEW_ANIME", label: "New Anime", hint: "Add this title to the site" },
  { id: "NEW_SEASON", label: "New Season", hint: "A new season of a series" },
  { id: "MISSING_EPISODE", label: "Missing Episode", hint: "An episode is missing" },
  { id: "DUB", label: "Dub", hint: "Add a dubbed version" },
  { id: "SUBTITLE", label: "Subtitle", hint: "Add subtitles for it" },
  { id: "OTHER", label: "Other", hint: "Something else" },
];

export const REQUEST_TYPE_LABELS: Record<RequestType, string> =
  Object.fromEntries(REQUEST_TYPES.map((t) => [t.id, t.label])) as Record<
    RequestType,
    string
  >;

/** Public badge label + colours for every request status. */
export const REQUEST_STATUS_META: Record<
  RequestStatus,
  { label: string; className: string; dot: string }
> = {
  REQUESTED: {
    label: "Requested",
    className: "bg-white/10 text-white/80 ring-white/15",
    dot: "bg-white/60",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    className: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
    dot: "bg-amber-400",
  },
  PLANNED: {
    label: "Coming Soon",
    className: "bg-violet-500/20 text-violet-2 ring-violet-400/30",
    dot: "bg-violet-2",
  },
  PROCESSING: {
    label: "Processing",
    className: "bg-blue-500/15 text-blue-300 ring-blue-400/30",
    dot: "bg-blue-400",
  },
  ADDED: {
    label: "Added",
    className: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
    dot: "bg-emerald-400",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-500/15 text-red-300 ring-red-400/30",
    dot: "bg-red-400",
  },
};

export const REQUEST_STATUS_ORDER: RequestStatus[] = [
  "REQUESTED",
  "UNDER_REVIEW",
  "PLANNED",
  "PROCESSING",
  "ADDED",
  "REJECTED",
];

export function statusMeta(status: string) {
  return (
    REQUEST_STATUS_META[status as RequestStatus] ?? {
      label: status,
      className: "bg-white/10 text-white/80 ring-white/15",
      dot: "bg-white/60",
    }
  );
}

export type RequestSort = "MOST_REQUESTED" | "RECENTLY_REQUESTED" | "RECENTLY_ADDED";

export const REQUEST_SORTS: { id: RequestSort; label: string }[] = [
  { id: "MOST_REQUESTED", label: "Most Requested" },
  { id: "RECENTLY_REQUESTED", label: "Recently Requested" },
  { id: "RECENTLY_ADDED", label: "Recently Added" },
];

export const PAGE_SIZE = 12;

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/** True when the request tables/functions haven't been created yet. */
export function isMissingSchema(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error ?? "");
  return (
    /PGRST20[25]/.test(message) ||
    /does not exist/i.test(message) ||
    /schema cache/i.test(message) ||
    /could not find the (table|function)/i.test(message)
  );
}

/** Never surface raw API/database text to visitors. */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const message =
    error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error ?? "");
  if (/rate limit/i.test(message)) {
    return "You've made a lot of requests today. Please try again tomorrow.";
  }
  if (/invalid/i.test(message)) {
    return "That request isn't valid. Please pick the anime again.";
  }
  return friendlySearchMessage(message) || fallback;
}

function friendlySearchMessage(message: string): string {
  if (/rate.?limit|429/i.test(message)) {
    return "The anime database is busy right now. Please try again in a moment.";
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Anonymous visitor identity                                          */
/* ------------------------------------------------------------------ */

const KEY_STORAGE = "animelk:requester";

/**
 * A random device-scoped id used to prevent the same visitor from inflating a
 * request count. No personal information is involved, and signed-in users fall
 * back to their auth id when available.
 */
export function requesterKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(KEY_STORAGE);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `anon-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(KEY_STORAGE, id);
    return id;
  } catch {
    return `anon-${Math.random().toString(36).slice(2)}`;
  }
}

async function supporterKey(): Promise<string> {
  const sb = supabaseBrowser();
  try {
    const { data } = await sb.auth.getSession();
    if (data.session?.user?.id) return `user:${data.session.user.id}`;
  } catch {
    // anonymous visitor
  }
  return `anon:${requesterKey()}`;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function fetchRequestsForExternalIds(
  ids: number[],
  source = "anilist"
): Promise<AnimeRequest[]> {
  if (ids.length === 0) return [];
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("anime_requests")
    .select(REQUEST_FIELDS)
    .eq("source", source)
    .in("external_id", ids);
  if (error) throw error;
  return (data as unknown as AnimeRequest[]) ?? [];
}

export interface FeedOptions {
  sort: RequestSort;
  status: RequestStatus | "ALL";
  from: number;
  to: number;
}

export async function fetchRequestFeed({
  sort,
  status,
  from,
  to,
}: FeedOptions): Promise<{ rows: AnimeRequest[]; total: number }> {
  const sb = supabaseBrowser();
  let query = sb.from("anime_requests").select(REQUEST_FIELDS, { count: "exact" });

  if (sort === "RECENTLY_ADDED") {
    query = query.eq("status", "ADDED").order("updated_at", { ascending: false });
  } else if (sort === "RECENTLY_REQUESTED") {
    query = query.order("last_requested_at", { ascending: false });
  } else {
    query = query
      .order("request_count", { ascending: false })
      .order("last_requested_at", { ascending: false });
  }

  if (status !== "ALL") query = query.eq("status", status);

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return {
    rows: (data as unknown as AnimeRequest[]) ?? [],
    total: count ?? 0,
  };
}

export async function fetchSupportedIds(): Promise<Set<number>> {
  const key = await supporterKey();
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc("anime_request_support_ids", {
    p_supporter_key: key,
  });
  if (error) throw error;
  return new Set(((data as unknown as number[]) ?? []).map(Number));
}

/* ------------------------------------------------------------------ */
/* Writes (RPC only)                                                   */
/* ------------------------------------------------------------------ */

export interface SubmitResult {
  request: AnimeRequest;
  created: boolean;
  alreadySupported: boolean;
}

function parseRpc(data: unknown): SubmitResult {
  const payload = (data ?? {}) as {
    request?: AnimeRequest;
    created?: boolean;
    already_supported?: boolean;
  };
  if (!payload.request) throw new Error("Request not saved");
  return {
    request: payload.request,
    created: Boolean(payload.created),
    alreadySupported: Boolean(payload.already_supported),
  };
}

export async function submitAnimeRequest(input: {
  anime: CatalogAnime;
  requestType: RequestType;
  season: number;
  seasonLabel: string | null;
  message: string;
}): Promise<SubmitResult> {
  const key = await supporterKey();
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc("submit_anime_request", {
    p_source: input.anime.source,
    p_external_id: input.anime.externalId,
    p_title: input.anime.title,
    p_title_english: input.anime.titleEnglish,
    p_title_native: input.anime.titleNative,
    p_romaji: input.anime.romaji,
    p_cover: input.anime.cover,
    p_format: input.anime.format,
    p_status: input.anime.status,
    p_episodes: input.anime.episodes,
    p_year: input.anime.year,
    p_season: input.season,
    p_season_label: input.seasonLabel,
    p_season_year: input.anime.year,
    p_request_type: input.requestType,
    p_supporter_key: key,
    p_message: input.message.trim() ? input.message.trim().slice(0, 300) : null,
  });
  if (error) throw error;
  return parseRpc(data);
}

export async function supportAnimeRequest(
  requestId: number,
  message = ""
): Promise<SubmitResult> {
  const key = await supporterKey();
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc("support_anime_request", {
    p_request_id: requestId,
    p_supporter_key: key,
    p_message: message.trim() ? message.trim().slice(0, 300) : null,
  });
  if (error) throw error;
  return parseRpc(data);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** The existing request matching a selection (same provider id, type, season). */
export function findMatchingRequest(
  rows: AnimeRequest[],
  anime: CatalogAnime,
  requestType: RequestType,
  season: number
): AnimeRequest | null {
  const exact = rows.find(
    (r) =>
      r.source === anime.source &&
      Number(r.external_id) === anime.externalId &&
      r.request_type === requestType &&
      (r.season ?? 0) === season
  );
  if (exact) return exact;
  // Fall back to any request for this title, so we can still say
  // "already requested" rather than offering a duplicate.
  return (
    rows.find(
      (r) => r.source === anime.source && Number(r.external_id) === anime.externalId
    ) ?? null
  );
}

/** Status text for catalogue (AniList) values, in the wording users expect. */
export function catalogStatusLabel(status: string | null): string {
  switch (status) {
    case "RELEASING":
      return "Currently Airing";
    case "FINISHED":
      return "Finished";
    case "NOT_YET_RELEASED":
      return "Upcoming";
    case "CANCELLED":
      return "Cancelled";
    case "HIATUS":
      return "On Hiatus";
    default:
      return status ?? "";
  }
}

/** Compact format label (TV / Movie / OVA / ONA …). */
export function catalogFormatLabel(format: string | null): string {
  switch (format) {
    case "TV_SHORT":
      return "TV Short";
    case "MOVIE":
      return "Movie";
    case "SPECIAL":
      return "Special";
    case "MUSIC":
      return "Music";
    case "OTHER":
      return "Other";
    default:
      return format ?? "";
  }
}

/** "2026 • TV • 24 Episodes" — compact metadata line used across the feature. */
export function catalogMeta(anime: {
  year: number | null;
  format: string | null;
  episodes: number | null;
  status: string | null;
}): string {
  return [
    anime.year ? String(anime.year) : null,
    catalogFormatLabel(anime.format) || null,
    anime.episodes ? `${anime.episodes} Episodes` : null,
    catalogStatusLabel(anime.status) || null,
  ]
    .filter(Boolean)
    .join(" • ");
}

export function requestSeasonLabel(season: number): string | null {
  return season > 0 ? `Season ${season}` : null;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
