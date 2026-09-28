import data from "@/data/anime.json";

export interface Anime {
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
  quality?: string;
  isDub?: boolean;
  trailerUrl?: string;
  completed?: boolean;
}

export const db = data as Record<string, Anime[]>;

export const allAnime: Anime[] = (() => {
  const seen = new Set<number>();
  const out: Anime[] = [];
  for (const list of Object.values(db)) {
    for (const a of list) {
      if (!seen.has(a.id) && a.coverImage) {
        seen.add(a.id);
        out.push(a);
      }
    }
  }
  return out;
})();

export const heroSlides = db.trending.filter((a) => a.bannerImage).slice(0, 6);

export const librarySlides = [...db.trending, ...db.popular, ...db.movies]
  .filter((a) => a.bannerImage)
  .slice(6, 12);

export function score(a: Anime) {
  return a.averageScore ? (a.averageScore / 10).toFixed(1) : "–";
}

export function year(a: Anime) {
  return a.seasonYear || 2025;
}

export function ageRating(a: Anime) {
  return ["PG", "PG-13", "R", "NC-17", "G"][a.id % 5];
}

export function metaTime(a: Anime) {
  if (a.format === "MOVIE" || a.format === "SPECIAL") {
    return `${a.duration || 120} mins`;
  }
  if (a.episodes) return `${a.episodes} Episodes`;
  return "Series";
}

const QUALITY = [
  { label: "HD", color: "#16a34a" },
  { label: "4K", color: "#e07100" },
  { label: "FHD", color: "#ea580c" },
  { label: "SUB", color: "#7c3aed" },
];

const QUALITY_MAP: Record<string, { label: string; color: string }> = {
  HD: { label: "HD", color: "#16a34a" },
  FHD: { label: "FHD", color: "#ea580c" },
  "4K": { label: "4K", color: "#e07100" },
  SUB: { label: "SUB", color: "#7c3aed" },
};

export function qualityBadges(a: Anime) {
  const first = a.quality && QUALITY_MAP[a.quality]
    ? QUALITY_MAP[a.quality]
    : QUALITY[a.id % QUALITY.length];
  const badges = [first];
  const isSub = a.isDub !== undefined ? !a.isDub : a.id % 3 === 0;
  const second =
    first.label === "SUB"
      ? { label: "DUB", color: "#0a0000" }
      : isSub
        ? { label: "SUB", color: "#7c3aed" }
        : { label: "DUB", color: "#0a0000" };
  badges.push(second);
  return badges;
}

export function findByGenre(genre: string): Anime {
  return allAnime.find((a) => a.genres.includes(genre)) ?? allAnime[0];
}

export function formatLabel(format: string) {
  switch (format) {
    case "TV":
      return "TV Series";
    case "MOVIE":
      return "Movie";
    case "OVA":
      return "OVA";
    case "ONA":
      return "ONA";
    case "SPECIAL":
      return "Special";
    case "TV_SHORT":
      return "TV Short";
    default:
      return "Other";
  }
}

export function statusLabel(status: string) {
  switch (status) {
    case "RELEASING":
      return "Releasing";
    case "FINISHED":
      return "Finished";
    case "NOT_YET_RELEASED":
      return "Upcoming";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function relatedAnime(anime: Anime, count = 7): Anime[] {
  const scored = allAnime
    .filter((a) => a.id !== anime.id)
    .map((a) => ({
      anime: a,
      common: a.genres.filter((g) => anime.genres.includes(g)).length,
    }))
    .filter((x) => x.common > 0)
    .sort((x, y) => y.common - x.common)
    .map((x) => x.anime);
  const fill = allAnime.filter(
    (a) => a.id !== anime.id && !scored.includes(a)
  );
  return [...scored, ...fill].slice(0, count);
}
