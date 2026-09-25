"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "./ui";

interface AnimeSeed {
  id: number;
  title: string;
  romaji: string;
  description: string;
  bannerImage: string;
  coverImage: string;
  genres: string[];
  averageScore: number;
  duration: number;
  episodes: number;
  format: string;
  seasonYear: number;
  status: string;
}

type Library = Record<string, AnimeSeed[]>;

const QUALITY = ["HD", "4K", "FHD", "SUB"];
const AGE = ["PG", "PG-13", "R", "NC-17", "G"];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const SECTIONS: { slug: string; items: AnimeSeed[] | null }[] = [
  { slug: "categories", items: null },
  { slug: "new-series", items: null },
  { slug: "new-anime-movies", items: null },
  { slug: "airing", items: null },
  { slug: "new-anime", items: null },
  { slug: "top-series", items: null },
  { slug: "action-anime", items: null },
  { slug: "top-movies", items: null },
  { slug: "library", items: null },
  { slug: "browse", items: null },
  { slug: "horror", items: null },
  { slug: "anime-movies", items: null },
  { slug: "slice-of-life", items: null },
];

function buildRows(lib: Library) {
  const all: AnimeSeed[] = [];
  const seen = new Set<number>();
  for (const list of Object.values(lib)) {
    for (const a of list) {
      if (!seen.has(a.id) && a.coverImage) {
        seen.add(a.id);
        all.push(a);
      }
    }
  }

  const usedSlugs = new Set<string>();
  const rows = all.map((a) => {
    let slug = slugify(a.title) || `anime-${a.id}`;
    const base = slug;
    let n = 1;
    while (usedSlugs.has(slug)) slug = `${base}-${n++}`;
    usedSlugs.add(slug);
    return {
      id: a.id,
      anilist_id: a.id,
      slug,
      title: a.title,
      romaji: a.romaji || null,
      description: a.description || null,
      banner_image: a.bannerImage || null,
      cover_image: a.coverImage || null,
      format: a.format || "TV",
      status: a.status || "FINISHED",
      season_year: a.seasonYear || null,
      episodes_count: a.episodes || 0,
      duration: a.duration || null,
      average_score: a.averageScore || null,
      popularity: Math.round((a.averageScore || 0) * 1000),
      age_rating: AGE[a.id % AGE.length],
      quality: QUALITY[a.id % QUALITY.length],
      is_dub: a.id % 3 !== 0,
      is_new: false,
      is_trending: lib.trending.some((t) => t.id === a.id),
      is_top: lib.topToday.some((t) => t.id === a.id) || lib.topMovies.some((t) => t.id === a.id),
      top_position:
        [...lib.topToday, ...lib.topMovies].findIndex((t) => t.id === a.id) + 1 || null,
    };
  });

  const hero = lib.trending.filter((a) => a.bannerImage).slice(0, 6);
  const librarySlides = [...lib.trending, ...lib.popular, ...lib.movies]
    .filter((a) => a.bannerImage)
    .slice(6, 12);

  const sectionMap: Record<string, AnimeSeed[]> = {
    "new-series": lib.trending,
    "new-anime-movies": lib.movies,
    airing: lib.airing,
    "new-anime": lib.popular,
    "top-series": lib.topToday,
    "action-anime": lib.action,
    "top-movies": lib.topMovies,
    library: librarySlides,
    browse: all,
    horror: lib.horror,
    "anime-movies": lib.movies,
    "slice-of-life": lib.family,
  };

  return { all, rows, hero, sectionMap };
}

export default function LibraryImport() {
  const sb = supabaseBrowser();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  const addLog = (line: string) => setLog((l) => [...l, line]);

  const run = async () => {
    setBusy(true);
    setLog([]);
    setSummary(null);
    try {
      const lib = (await fetch("/api/library").then((r) => r.json())) as Library;
      const { all, rows, hero, sectionMap } = buildRows(lib);

      // 1. genres
      const { data: existingGenres } = await sb.from("genres").select("id, name");
      const nameToId = new Map<string, number>(
        (existingGenres ?? []).map((g: { id: number; name: string }) => [g.name, g.id])
      );
      const genreNames = [...new Set(all.flatMap((a) => a.genres))];
      const missingGenres = genreNames.filter((n) => !nameToId.has(n));
      if (missingGenres.length) {
        const { data: added } = await sb
          .from("genres")
          .insert(missingGenres.map((name) => ({ slug: slugify(name), name })))
          .select("id, name");
        (added ?? []).forEach((g: { id: number; name: string }) => nameToId.set(g.name, g.id));
        addLog(`Genres: added ${missingGenres.length}`);
      } else {
        addLog("Genres: already complete");
      }

      // 2. anime (skip existing)
      const { data: existingAnime } = await sb.from("anime").select("id");
      const existingIds = new Set((existingAnime ?? []).map((a: { id: number }) => a.id));
      const missingAnime = rows.filter((r) => !existingIds.has(r.id));
      if (missingAnime.length) {
        const { error } = await sb
          .from("anime")
          .upsert(missingAnime, { ignoreDuplicates: true });
        if (error) throw new Error(error.message);
        addLog(`Anime: added ${missingAnime.length}, kept ${existingIds.size} existing`);
      } else {
        addLog(`Anime: all ${existingIds.size} already present`);
      }

      // 3. anime_genres
      const { data: existingPairs } = await sb
        .from("anime_genres")
        .select("anime_id, genre_id");
      const pairSet = new Set(
        (existingPairs ?? []).map(
          (p: { anime_id: number; genre_id: number }) => `${p.anime_id}:${p.genre_id}`
        )
      );
      const pairs = all
        .flatMap((a) =>
          (a.genres ?? []).map((g) => ({ anime_id: a.id, genre_id: nameToId.get(g) }))
        )
        .filter((p): p is { anime_id: number; genre_id: number } => Boolean(p.genre_id))
        .filter((p) => !pairSet.has(`${p.anime_id}:${p.genre_id}`));
      if (pairs.length) {
        await sb.from("anime_genres").upsert(pairs, { ignoreDuplicates: true });
        addLog(`Genres links: added ${pairs.length}`);
      } else {
        addLog("Genres links: complete");
      }

      // 4. episodes (placeholder rows, skip existing)
      const { data: existingEps } = await sb.from("episodes").select("anime_id, episode_number");
      const epSet = new Set(
        (existingEps ?? []).map(
          (e: { anime_id: number; episode_number: number }) => `${e.anime_id}:${e.episode_number}`
        )
      );
      const epRows = all
        .filter((a) => a.format !== "MOVIE" && a.format !== "SPECIAL" && a.episodes)
        .flatMap((a) =>
          Array.from({ length: Math.min(a.episodes, 40) }, (_, i) => ({
            anime_id: a.id,
            episode_number: i + 1,
            title: null,
            duration: a.duration || null,
          })).filter((e) => !epSet.has(`${e.anime_id}:${e.episode_number}`))
        );
      if (epRows.length) {
        await sb.from("episodes").upsert(epRows, { ignoreDuplicates: true });
        addLog(`Episodes: added ${epRows.length} placeholder rows (your URLs untouched)`);
      } else {
        addLog("Episodes: complete");
      }

      // 5. sections + section_items
      const { data: sections } = await sb.from("sections").select("id, slug");
      const slugToId = new Map<string, number>(
        (sections ?? []).map((s: { id: number; slug: string }) => [s.slug, s.id])
      );
      const { data: existingItems } = await sb
        .from("section_items")
        .select("section_id, anime_id");
      const itemSet = new Set(
        (existingItems ?? []).map(
          (i: { section_id: number; anime_id: number }) => `${i.section_id}:${i.anime_id}`
        )
      );
      const itemRows = SECTIONS.flatMap((s) => {
        const items = sectionMap[s.slug];
        const sectionId = slugToId.get(s.slug);
        if (!sectionId || !items) return [];
        return items
          .map((a, i) => ({
            section_id: sectionId,
            anime_id: a.id,
            position: i + 1,
          }))
          .filter((r) => !itemSet.has(`${r.section_id}:${r.anime_id}`));
      });
      if (itemRows.length) {
        await sb.from("section_items").upsert(itemRows, { ignoreDuplicates: true });
        addLog(`Section items: added ${itemRows.length}`);
      } else {
        addLog("Section items: complete");
      }

      // 6. hero slides
      const { data: existingHero } = await sb.from("hero_slides").select("anime_id, position");
      const heroAnime = new Set((existingHero ?? []).map((h: { anime_id: number }) => h.anime_id));
      const maxPos = (existingHero ?? []).reduce(
        (m: number, h: { position: number }) => Math.max(m, h.position),
        0
      );
      const heroRows = hero
        .filter((a) => !heroAnime.has(a.id))
        .map((a, i) => ({ anime_id: a.id, position: maxPos + i + 1 }));
      if (heroRows.length) {
        await sb.from("hero_slides").insert(heroRows);
        addLog(`Hero slides: added ${heroRows.length}`);
      } else {
        addLog("Hero slides: complete");
      }

      setSummary(
        `Import finished. Library now has ${existingIds.size + missingAnime.length} anime. Your custom edits and episode URLs were kept.`
      );
    } catch (err) {
      setSummary(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-white">Import bundled library</h3>
          <p className="mt-1 text-[13px] text-muted">
            Restores all 97 anime, episodes, sections and hero slides from the bundled dataset.
            Existing rows (and your edits / episode URLs) are never overwritten.
          </p>
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? "Importing..." : "Import Library"}
        </Button>
      </div>

      {(log.length > 0 || summary) && (
        <div className="mt-4 rounded-lg border border-white/10 bg-ink p-4">
          {log.map((line, i) => (
            <p key={i} className="font-mono text-[12px] leading-6 text-white/80">
              ✓ {line}
            </p>
          ))}
          {summary && (
            <p
              className={`mt-2 border-t border-white/10 pt-2 text-[13px] font-semibold ${
                summary.startsWith("Import failed") ? "text-red-300" : "text-emerald-300"
              }`}
            >
              {summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
