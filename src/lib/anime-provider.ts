/**
 * Anime catalogue search used by the "Request an Anime" feature.
 *
 * The app talks to this module, never to a specific API, so the metadata
 * provider can be swapped later (AniList → MAL/AnimeSchedule/…) by adding
 * another implementation below and changing `activeProviderId`.
 *
 * AniList's own `search` argument is a fuzzy match across the romaji, English,
 * native and synonym titles, which gives us English + Japanese + alternative
 * title support for free.
 */

const ANILIST_API = "https://graphql.anilist.co";

export interface CatalogAnime {
  externalId: number;
  source: string;
  /** Best display title (English preferred, then romaji, then native). */
  title: string;
  titleEnglish: string | null;
  titleNative: string | null;
  romaji: string | null;
  cover: string | null;
  format: string | null;
  status: string | null;
  year: number | null;
  episodes: number | null;
  duration: number | null;
}

export interface AnimeCatalogProvider {
  id: string;
  label: string;
  search(query: string, limit: number): Promise<CatalogAnime[]>;
}

/* ------------------------------------------------------------------ */
/* Results cache                                                       */
/* ------------------------------------------------------------------ */

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 300;

type CacheEntry = { at: number; data: CatalogAnime[] };
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): CatalogAnime[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key: string, data: CatalogAnime[]) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), data });
}

/* ------------------------------------------------------------------ */
/* AniList provider                                                    */
/* ------------------------------------------------------------------ */

interface GqlMedia {
  id: number;
  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;
  coverImage?: { large?: string | null; medium?: string | null } | null;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: number | null;
  seasonYear?: number | null;
}

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { large medium }
  format
  status
  episodes
  duration
  seasonYear
`;

function mapMedia(m: GqlMedia): CatalogAnime {
  const english = m.title?.english?.trim() || null;
  const romaji = m.title?.romaji?.trim() || null;
  const native = m.title?.native?.trim() || null;
  return {
    externalId: m.id,
    source: "anilist",
    title: english ?? romaji ?? native ?? `AniList #${m.id}`,
    titleEnglish: english,
    titleNative: native,
    romaji,
    cover: m.coverImage?.large ?? m.coverImage?.medium ?? null,
    format: m.format ?? null,
    status: m.status ?? null,
    year: m.seasonYear ?? null,
    episodes: m.episodes ?? null,
    duration: m.duration ?? null,
  };
}

/** Collapses whitespace and strips punctuation that commonly breaks fuzzy search. */
function normalize(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function loosen(query: string): string {
  return query
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function anilistSearch(query: string, limit: number): Promise<CatalogAnime[]> {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `query($search: String, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) {
            ${MEDIA_FIELDS}
          }
        }
      }`,
      variables: { search: query, perPage: limit },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (!res.ok) throw new Error(`AniList responded ${res.status}`);

  const json = (await res.json()) as {
    data?: { Page?: { media?: GqlMedia[] | null } | null };
    errors?: unknown[];
  };
  if (json.errors?.length) throw new Error("AniList query error");

  return (json.data?.Page?.media ?? []).map(mapMedia);
}

const anilistProvider: AnimeCatalogProvider = {
  id: "anilist",
  label: "AniList",
  async search(query: string, limit: number) {
    const q = normalize(query);
    if (q.length < 2) return [];

    const cacheKey = `${this.id}:${limit}:${q.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    let results = await anilistSearch(q, limit);

    // Spelling/punctuation variations: retry once with a loosened query
    // (e.g. "Demon Slayer: Mugen Train!" → "Demon Slayer Mugen Train").
    if (results.length === 0) {
      const loose = loosen(q);
      if (loose.length >= 2 && loose.toLowerCase() !== q.toLowerCase()) {
        results = await anilistSearch(loose, limit);
      }
    }

    cacheSet(cacheKey, results);
    return results;
  },
};

/* ------------------------------------------------------------------ */
/* Active provider                                                     */
/* ------------------------------------------------------------------ */

const PROVIDERS: Record<string, AnimeCatalogProvider> = {
  anilist: anilistProvider,
};

const activeProviderId = "anilist";

export function getAnimeProvider(): AnimeCatalogProvider {
  return PROVIDERS[activeProviderId];
}

export async function searchAnimeCatalog(
  query: string,
  limit = 12
): Promise<CatalogAnime[]> {
  return getAnimeProvider().search(query, limit);
}
