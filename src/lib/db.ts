import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Anime } from "./anime";
import { allAnime, isCompleted, isMovie, relatedAnime } from "./anime";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}

interface DbAnime {
  id: number;
  title: string;
  romaji: string | null;
  description: string | null;
  banner_image: string | null;
  cover_image: string | null;
  format: string;
  status: string;
  season_year: number | null;
  episodes_count: number;
  duration: number | null;
  average_score: number | null;
  age_rating: string;
  quality: string | null;
  is_dub: boolean | null;
  trailer_url: string | null;
  completed: boolean | null;
  /** Admin visibility switch. Missing/undefined is treated as visible. */
  is_active: boolean | null;
  anime_genres?: { genres: { name: string } | null }[];
}

/**
 * A section whose slug mentions "movies" (e.g. "anime-movies", "top-movies",
 * "new-anime-movies") is a movies-only space. Anything in it must be a movie —
 * series are never allowed to share the space, no matter how the section's
 * curated items were configured.
 */
function isMovieSection(slug: string): boolean {
  return /movie/i.test(slug);
}

/**
 * Whether a title is published on the public site. The admin panel's
 * on/off switch writes anime.is_active; anything that is not explicitly
 * `false` stays visible so the site keeps working even before the
 * visibility migration has been applied.
 */
export function isPublic(row: Pick<DbAnime, "is_active">): boolean {
  return row.is_active !== false;
}

export function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url
    .trim()
    .replace(/^http:\/\//i, "https://")
    .replace(
      /^https:\/\/(?:www\.)?themoviedb\.org\/t\/p\//i,
      "https://image.tmdb.org/t/p/"
    );
}

export function mapAnime(row: DbAnime): Anime {
  return {
    id: row.id,
    title: row.title,
    romaji: row.romaji ?? "",
    description: row.description ?? "",
    bannerImage: normalizeImageUrl(row.banner_image),
    coverImage: normalizeImageUrl(row.cover_image),
    genres: (row.anime_genres ?? [])
      .map((g) => g.genres?.name)
      .filter((n): n is string => Boolean(n)),
    averageScore: row.average_score ?? 0,
    duration: row.duration ?? 0,
    episodes: row.episodes_count,
    format: row.format,
    seasonYear: row.season_year ?? 0,
    status: row.status,
    quality: row.quality ?? undefined,
    isDub: row.is_dub ?? undefined,
    trailerUrl: row.trailer_url ?? undefined,
    completed: Boolean(row.completed),
  };
}

export interface HomeTopic {
  name: string;
  color: string;
  image: string;
}

export interface HomeSection {
  slug: string;
  title: string;
  kind: "carousel" | "top10" | "grid" | "slider" | "panel" | "filter" | "topics";
  panel: boolean;
  viewAllUrl: string | null;
  items: Anime[];
  topics: HomeTopic[] | null;
}

export interface HomeData {
  hero: Anime[];
  sections: HomeSection[];
}

export async function fetchHome(): Promise<HomeData | null> {
  const sb = supabase();
  if (!sb) return null;

  try {
    const [heroRes, sectionsRes, topicsRes] = await Promise.all([
      sb
        .from("hero_slides")
        .select("position, anime(*)")
        .eq("is_active", true)
        .order("position"),
      sb
        .from("sections")
        .select(
          "slug, title, kind, panel, view_all_url, sort_order, section_items(position, anime(*, anime_genres(genres(name))))"
        )
        .eq("is_active", true)
        .order("sort_order"),
      sb
        .from("topics")
        .select("name, color, image_url, genre_id")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (heroRes.error || sectionsRes.error || topicsRes.error) return null;

    const sectionRows = (sectionsRes.data as unknown as {
      slug: string;
      title: string;
      kind: HomeSection["kind"];
      panel: boolean;
      view_all_url: string | null;
      section_items: { position: number; anime: DbAnime }[] | null;
    }[]) ?? [];

    let allRows: DbAnime[] = [];
    if (sectionRows.length > 0) {
      const { data: allRes } = await sb
        .from("anime")
        .select("*, anime_genres(genres(name))")
        .limit(500);
      // Titles switched OFF in the admin panel are dropped here, which also
      // keeps them out of every section built from this list below.
      allRows = ((allRes as unknown as DbAnime[]) ?? []).filter(isPublic);
    }

    const hero = ((heroRes.data as unknown as { anime: DbAnime }[]) ?? [])
      .filter((s) => s.anime && isPublic(s.anime) && s.anime.banner_image)
      .map((s) => mapAnime(s.anime));

    const topicRows = (topicsRes.data as unknown as {
      name: string;
      color: string;
      image_url: string | null;
    }[]) ?? [];
    const topics: HomeTopic[] = topicRows.map((t) => ({
      name: t.name,
      color: t.color,
      image: t.image_url ?? "",
    }));

    const allItems = allRows.map(mapAnime);
    // Movies, newest release first (then by score). Kept ready so every
    // movies-only section draws from the same catalog-wide pool.
    const movieItems = allItems.filter(isMovie).sort(
      (a, b) =>
        (b.seasonYear || 0) - (a.seasonYear || 0) ||
        b.averageScore - a.averageScore
    );

    // "Latest Episode" — only currently releasing titles with an uploaded
    // episode, ordered by the most recently added episode. Finished / not-yet-
    // released / cancelled shows are added in bulk from the admin panel and
    // must stay out of this row. The row renders as a 3-row grid, so we gather
    // enough unique titles to fill it (newest first, never duplicated).
    let latestEpisodeItems: Anime[] | null = null;
    if (sectionRows.some((s) => s.slug === "latest-episode")) {
      const byId = new Map(allItems.map((a) => [a.id, a]));
      const releasingIds = allItems
        .filter((a) => a.status === "RELEASING")
        .map((a) => a.id);

      // Episodes carry no created_at, but `id` is an identity column, so the
      // highest id is the most recently added episode. The scan is restricted
      // to releasing titles in the query itself, so a bulk import of finished
      // shows can never push the airing ones out of the result window.
      const lastEp: Record<number, number> = {};
      const orderedIds: number[] = [];
      if (releasingIds.length > 0) {
        const { data: epRows } = await sb
          .from("episodes")
          .select("id, anime_id, episode_number, video_url")
          .in("anime_id", releasingIds)
          .order("id", { ascending: false })
          .limit(800);
        for (const r of ((epRows as unknown as {
          id: number;
          anime_id: number;
          episode_number: number;
          video_url: string | null;
        }[]) ?? [])) {
          if (!r.video_url) continue;
          if (lastEp[r.anime_id] === undefined) orderedIds.push(r.anime_id);
          if (lastEp[r.anime_id] === undefined || r.episode_number > lastEp[r.anime_id]) {
            lastEp[r.anime_id] = r.episode_number;
          }
        }
      }

      // First appearance in the id-descending scan is the anime's newest episode.
      latestEpisodeItems = orderedIds
        .map((id) => byId.get(id))
        .filter((a): a is Anime => Boolean(a))
        .map((a) => ({ ...a, lastEpisode: lastEp[a.id] ?? 1 }))
        .slice(0, 24);
    }

    // "Completed Anime" (previously "New Anime") — only titles whose
    // authoritative status marks them finished, most recently updated first.
    // Filtering happens in the database, not by downloading the whole catalog.
    let completedItems: Anime[] | null = null;
    if (
      sectionRows.some(
        (s) => s.slug === "new-anime" || s.slug === "completed-anime"
      )
    ) {
      const { data: finRows } = await sb
        .from("anime")
        .select("*, anime_genres(genres(name))")
        .eq("status", "FINISHED")
        .order("updated_at", { ascending: false });
      completedItems = ((finRows as unknown as DbAnime[]) ?? [])
        .filter(isPublic)
        .map(mapAnime)
        .filter(isCompleted);
    }

    const sections: HomeSection[] = (sectionRows ?? []).map((s) => {
      if (s.slug === "latest-episode") {
        return {
          slug: s.slug,
          title: s.title,
          kind: s.kind,
          panel: s.panel,
          viewAllUrl: s.view_all_url,
          items: latestEpisodeItems ?? [],
          topics: null,
        };
      }

      // "Completed Anime" replaces the old "New Anime" row. Its contents come
      // from the FINISHED status filter above, so the title is forced here too.
      if (s.slug === "new-anime" || s.slug === "completed-anime") {
        return {
          slug: s.slug,
          title: "Completed Anime",
          kind: "carousel",
          panel: s.panel,
          viewAllUrl: s.view_all_url,
          items: completedItems ?? [],
          topics: null,
        };
      }

      // "Airing Now" is driven by each anime's status, which the admin picks on
      // the Anime page — only titles marked RELEASING belong in this row.
      if (s.slug === "airing") {
        return {
          slug: s.slug,
          title: s.title,
          kind: s.kind,
          panel: s.panel,
          viewAllUrl: s.view_all_url,
          items: allItems.filter((a) => a.status === "RELEASING"),
          topics: null,
        };
      }

      // Movies sections ("Anime Movies", "Top 10 Anime Movies Today", ...) are
      // strictly movies-only: the catalog's movie titles are used directly and
      // any curated/series entries are filtered out, so a series placed here by
      // mistake can never appear. Movies added through the admin panel (Format
      // = MOVIE) show up here automatically.
      if (isMovieSection(s.slug)) {
        let items: Anime[];
        if (s.kind === "top10") {
          items = [...movieItems]
            .sort((a, b) => b.averageScore - a.averageScore)
            .slice(0, 10);
        } else {
          const curated = (s.section_items ?? [])
            .filter((si) => si.anime && isPublic(si.anime))
            .sort((a, b) => a.position - b.position)
            .map((si) => mapAnime(si.anime))
            .filter(isMovie);
          const curatedIds = new Set(curated.map((a) => a.id));
          items = [
            ...curated,
            ...movieItems.filter((a) => !curatedIds.has(a.id)),
          ];
        }

        return {
          slug: s.slug,
          title: s.title,
          kind: s.kind,
          panel: s.panel,
          viewAllUrl: s.view_all_url,
          items,
          topics: null,
        };
      }

      let items: Anime[] =
        s.kind === "filter"
          ? allItems
          : (s.section_items ?? [])
              .filter((si) => si.anime && isPublic(si.anime))
              .sort((a, b) => a.position - b.position)
              .map((si) => mapAnime(si.anime));

      if (items.length === 0 && s.kind !== "topics" && s.kind !== "filter") {
        const all = allItems;
        if (s.kind === "top10") {
          items = [...all]
            .sort((a, b) => b.averageScore - a.averageScore)
            .slice(0, 10);
        } else if (s.kind === "slider") {
          items = all.filter((a) => a.bannerImage).slice(0, 6);
        } else {
          items = all;
        }
      }

      return {
        slug: s.slug,
        title: s.title,
        kind: s.kind,
        panel: s.panel,
        viewAllUrl: s.view_all_url,
        items,
        topics: s.kind === "topics" ? topics : null,
      };
    });

    return { hero, sections };
  } catch {
    return null;
  }
}

export async function getAnime(id: number): Promise<Anime | null> {
  const sb = supabase();
  if (!sb) return allAnime.find((a) => a.id === id) ?? null;
  try {
    const { data, error } = await sb
      .from("anime")
      .select("*, anime_genres(genres(name))")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    // A title switched OFF in the admin panel is unpublished: its detail and
    // watch pages 404 like any other missing title.
    if (!isPublic(data as DbAnime)) return null;
    return mapAnime(data as DbAnime);
  } catch {
    return null;
  }
}

export interface SubtitleTrack {
  url: string;
  label: string;
  lang: string;
  default?: boolean;
  /** Original uploaded file name (used when pushing the track to abyss.to). */
  filename?: string;
  /** abyss video id this track has already been uploaded to. */
  abyssSlug?: string;
}

export interface EpisodeMeta {
  episode_number: number;
  title: string | null;
  video_url: string | null;
  thumbnail: string | null;
  duration: number | null;
  is_premium: boolean;
  subtitles: SubtitleTrack[];
}

export async function getEpisodes(animeId: number): Promise<EpisodeMeta[]> {
  const sb = supabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("episodes")
      .select(
        "episode_number, title, video_url, thumbnail, duration, is_premium, subtitles"
      )
      .eq("anime_id", animeId)
      .order("episode_number");
    if (error) return [];
    return ((data as unknown as EpisodeMeta[]) ?? []).map((e) => ({
      ...e,
      subtitles: Array.isArray(e.subtitles) ? e.subtitles : [],
    }));
  } catch {
    return [];
  }
}

export async function searchAnime(query: string, limit = 8): Promise<Anime[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const match = (a: Anime) =>
    `${a.title} ${a.romaji} ${a.description} ${a.genres.join(" ")}`
      .toLowerCase()
      .includes(q);

  const sb = supabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("anime")
        .select("*, anime_genres(genres(name))")
        .limit(500);
      if (!error && data) {
        return (data as unknown as DbAnime[])
          .filter(isPublic)
          .map(mapAnime)
          .filter(match)
          .slice(0, limit);
      }
    } catch {
      // fall through to bundled data
    }
  }
  return allAnime.filter(match).slice(0, limit);
}

export async function getRelated(anime: Anime, count = 7): Promise<Anime[]> {
  const sb = supabase();
  if (!sb) return relatedAnime(anime, count);
  try {
    const { data, error } = await sb
      .from("anime")
      .select("*, anime_genres(genres(name))")
      .limit(500);
    if (error || !data) return relatedAnime(anime, count);

    const rows = (data as unknown as DbAnime[])
      .filter((r) => r.id !== anime.id && isPublic(r))
      .map(mapAnime);

    const scored = [...rows]
      .map((a) => ({
        a,
        common: a.genres.filter((g) => anime.genres.includes(g)).length,
      }))
      .filter((x) => x.common > 0)
      .sort((x, y) => y.common - x.common)
      .map((x) => x.a);

    const fill = rows
      .filter((a) => !scored.includes(a))
      .sort((a, b) => b.averageScore - a.averageScore);

    return [...scored, ...fill].slice(0, count);
  } catch {
    return relatedAnime(anime, count);
  }
}
