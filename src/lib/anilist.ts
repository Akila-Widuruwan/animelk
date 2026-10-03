const ANILIST_API = "https://graphql.anilist.co";

export interface AnilistMedia {
  id: number;
  titleEnglish: string | null;
  titleRomaji: string | null;
  status: string | null;
  seasonYear: number | null;
  episodes: number | null;
  format: string | null;
  nextEpisode: number | null;
  nextAiringAt: number | null;
  timeUntilAiring: number | null;
}

interface GqlMedia {
  id: number;
  title?: { romaji?: string | null; english?: string | null } | null;
  status?: string | null;
  seasonYear?: number | null;
  episodes?: number | null;
  format?: string | null;
  nextAiringEpisode?: {
    episode?: number | null;
    airingAt?: number | null;
    timeUntilAiring?: number | null;
  } | null;
}

const MEDIA_FIELDS = `
  id
  title { romaji english }
  status
  seasonYear
  episodes
  format
  nextAiringEpisode { episode airingAt timeUntilAiring }
`;

function mapMedia(m: GqlMedia): AnilistMedia {
  return {
    id: m.id,
    titleEnglish: m.title?.english ?? null,
    titleRomaji: m.title?.romaji ?? null,
    status: m.status ?? null,
    seasonYear: m.seasonYear ?? null,
    episodes: m.episodes ?? null,
    format: m.format ?? null,
    nextEpisode: m.nextAiringEpisode?.episode ?? null,
    nextAiringAt: m.nextAiringEpisode?.airingAt ?? null,
    timeUntilAiring: m.nextAiringEpisode?.timeUntilAiring ?? null,
  };
}

async function gql(query: string, variables: Record<string, unknown>) {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`AniList responded ${res.status}`);
  const json = (await res.json()) as { data?: Record<string, unknown>; errors?: unknown[] };
  if (json.errors?.length) throw new Error("AniList query error");
  return json.data ?? {};
}

export async function fetchAnilist(id: number): Promise<AnilistMedia | null> {
  const data = await gql(
    `query($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`,
    { id }
  );
  const media = (data as { Media?: GqlMedia | null }).Media;
  return media ? mapMedia(media) : null;
}

export async function searchAnilist(
  query: string,
  limit = 6
): Promise<AnilistMedia[]> {
  const data = await gql(
    `query($search: String, $perPage: Int) {
      Page(perPage: $perPage) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          ${MEDIA_FIELDS}
        }
      }
    }`,
    { search: query.trim(), perPage: limit }
  );
  const page = (data as { Page?: { media?: GqlMedia[] | null } | null }).Page;
  return (page?.media ?? []).map(mapMedia);
}
