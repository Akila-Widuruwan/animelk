const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";

export interface TmdbCredentials {
  apiKey?: string | null;
  accessToken?: string | null;
}

export function getTmdbEnvCredentials(): TmdbCredentials {
  return {
    apiKey: process.env.TMDB_API_KEY || null,
    accessToken: process.env.TMDB_ACCESS_TOKEN || null,
  };
}

export function hasCredential(creds: TmdbCredentials | null | undefined): boolean {
  return Boolean(creds && (creds.apiKey || creds.accessToken));
}

export type TmdbErrorKind = "missing-config" | "auth" | "rate-limited" | "network" | "api";

export class TmdbError extends Error {
  kind: TmdbErrorKind;
  constructor(kind: TmdbErrorKind, message?: string) {
    super(message ?? kind);
    this.kind = kind;
  }
}

async function tmdbGet(
  path: string,
  params: Record<string, string> = {},
  creds: TmdbCredentials | null = null
): Promise<Record<string, unknown>> {
  const c = creds ?? getTmdbEnvCredentials();
  if (!hasCredential(c)) throw new TmdbError("missing-config");
  const url = new URL(TMDB_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(c.accessToken
          ? { Authorization: `Bearer ${c.accessToken}` }
          : { Authorization: `Bearer ${c.apiKey}` }),
      },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) throw new TmdbError("auth");
    if (res.status === 429) throw new TmdbError("rate-limited");
    if (!res.ok) throw new TmdbError("api");
    return (await res.json()) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof TmdbError) throw e;
    throw new TmdbError("network");
  }
}

export interface TmdbSearchItem {
  id: number;
  mediaType: "tv" | "movie";
  title: string;
  originalTitle: string;
  year: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
}

export interface TmdbSearchResult {
  page: number;
  totalPages: number;
  totalResults: number;
  results: TmdbSearchItem[];
}

export async function searchTmdb(
  query: string,
  mediaType: "tv" | "movie",
  page = 1,
  creds: TmdbCredentials | null = null
): Promise<TmdbSearchResult> {
  const endpoint = mediaType === "tv" ? "/search/tv" : "/search/movie";
  const json = await tmdbGet(
    endpoint,
    {
      query: query.trim(),
      page: String(page),
      include_adult: "false",
    },
    creds
  );
  const rows = (json.results as Record<string, unknown>[]) ?? [];
  return {
    page: (json.page as number) ?? page,
    totalPages: (json.total_pages as number) ?? 1,
    totalResults: (json.total_results as number) ?? rows.length,
    results: rows.map((r) => ({
      id: Number(r.id),
      mediaType,
      title: String(r.name ?? r.title ?? "Untitled"),
      originalTitle: String(r.original_name ?? r.original_title ?? ""),
      year: String(r.first_air_date ?? r.release_date ?? "").slice(0, 4),
      overview: String(r.overview ?? ""),
      posterPath: (r.poster_path as string) ?? null,
      backdropPath: (r.backdrop_path as string) ?? null,
    })),
  };
}

export interface TmdbImage {
  filePath: string;
  width: number;
  height: number;
  lang: string;
  voteCount: number;
  voteAverage: number;
}

export interface TmdbImagesResult {
  posters: TmdbImage[];
  backdrops: TmdbImage[];
}

export async function tmdbImages(
  mediaType: "tv" | "movie",
  id: number,
  creds: TmdbCredentials | null = null
): Promise<TmdbImagesResult> {
  const endpoint = mediaType === "tv" ? `/tv/${id}/images` : `/movie/${id}/images`;
  const json = await tmdbGet(endpoint, { include_image_language: "en,null" }, creds);
  const mapImg = (r: Record<string, unknown>): TmdbImage => ({
    filePath: String(r.file_path ?? ""),
    width: Number(r.width) || 0,
    height: Number(r.height) || 0,
    lang: String(r.iso_639_1 ?? "") || "–",
    voteCount: Number(r.vote_count) || 0,
    voteAverage: Number(r.vote_average) || 0,
  });
  return {
    posters: ((json.posters as Record<string, unknown>[]) ?? []).map(mapImg),
    backdrops: ((json.backdrops as Record<string, unknown>[]) ?? []).map(mapImg),
  };
}

export function tmdbImageUrl(path: string | null, size: string): string {
  if (!path) return "";
  return `${TMDB_IMG}/${size}${path}`;
}

export const TMDB_POSTER_SIZES = ["w92", "w154", "w185", "w342", "w500", "w780", "original"];
export const TMDB_BACKDROP_SIZES = ["w300", "w780", "w1280", "original"];
export const POSTER_FINAL_SIZE = "w780";
export const BACKDROP_FINAL_SIZE = "w1280";
