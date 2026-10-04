import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Anime } from "./anime";
import { allAnime, relatedAnime } from "./anime";

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
  anime_genres?: { genres: { name: string } | null }[];
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
      allRows = (allRes as unknown as DbAnime[]) ?? [];
    }

    const hero = ((heroRes.data as unknown as { anime: DbAnime }[]) ?? [])
      .filter((s) => s.anime?.banner_image)
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

    // "Latest Episode" — RELEASING anime ordered by their most recently added
    // episode, each pointing at its last uploaded episode.
    let latestEpisodeItems: Anime[] | null = null;
    if (sectionRows.some((s) => s.slug === "latest-episode")) {
      const { data: relRows } = await sb
        .from("anime")
        .select("*, anime_genres(genres(name))")
        .eq("status", "RELEASING")
        .order("created_at", { ascending: false });
      const relItems = ((relRows as unknown as DbAnime[]) ?? []).map(mapAnime);

      // Episodes carry no created_at, but `id` is an identity column, so the
      // highest id is the most recently added episode.
      const lastEp: Record<number, number> = {};
      const latestEpId: Record<number, number> = {};
      const ids = relItems.map((a) => a.id);
      if (ids.length > 0) {
        const { data: epRows } = await sb
          .from("episodes")
          .select("id, anime_id, episode_number, video_url")
          .in("anime_id", ids)
          .order("id", { ascending: false });
        for (const r of ((epRows as unknown as {
          id: number;
          anime_id: number;
          episode_number: number;
          video_url: string | null;
        }[]) ?? [])) {
          if (!r.video_url) continue;
          if (latestEpId[r.anime_id] === undefined) latestEpId[r.anime_id] = r.id;
          if (lastEp[r.anime_id] === undefined || r.episode_number > lastEp[r.anime_id]) {
            lastEp[r.anime_id] = r.episode_number;
          }
        }
      }

      // Most recently added episode first; anime with no episodes go last.
      latestEpisodeItems = relItems
        .map((a) => ({ ...a, lastEpisode: lastEp[a.id] ?? 1 }))
        .sort((x, y) => (latestEpId[y.id] ?? 0) - (latestEpId[x.id] ?? 0));
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

      let items: Anime[] =
        s.kind === "filter"
          ? allItems
          : (s.section_items ?? [])
              .filter((si) => si.anime)
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
      .filter((r) => r.id !== anime.id)
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
