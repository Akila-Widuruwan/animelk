const API = "https://graphql.anilist.co";

const QUERIES = {
  trending: `query { Page(page: 1, perPage: 24) { media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { id title { romaji english } description bannerImage coverImage { extraLarge } genres averageScore duration episodes format seasonYear status } } }`,
  popular: `query { Page(page: 2, perPage: 16) { media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { id title { romaji english } description bannerImage coverImage { extraLarge } genres averageScore duration episodes format seasonYear status } } }`,
  movies: `query { Page(page: 1, perPage: 12) { media(type: ANIME, format: MOVIE, sort: POPULARITY_DESC, isAdult: false) { id title { romaji english } description bannerImage coverImage { extraLarge } genres averageScore duration episodes format seasonYear status } } }`,
  airing: `query { Page(page: 1, perPage: 12) { media(type: ANIME, status: RELEASING, sort: TRENDING_DESC, isAdult: false) { id title { romaji english } description bannerImage coverImage { extraLarge } genres averageScore duration episodes format seasonYear status } } }`,
  horror: `query { Page(page: 1, perPage: 12) { media(type: ANIME, genre: "Horror", sort: POPULARITY_DESC, isAdult: false) { id title { romaji english } description bannerImage coverImage { extraLarge } genres averageScore duration episodes format seasonYear status } } }`,
  family: `query { Page(page: 1, perPage: 12) { media(type: ANIME, genre: "Slice of Life", sort: POPULARITY_DESC, isAdult: false) { id title { romaji english } description bannerImage coverImage { extraLarge } genres averageScore duration episodes format seasonYear status } } }`,
  topToday: `query { Page(page: 1, perPage: 10) { media(type: ANIME, sort: SCORE_DESC, isAdult: false) { id title { romaji english } description bannerImage coverImage { extraLarge } genres averageScore duration episodes format seasonYear status } } }`,
  topMovies: `query { Page(page: 1, perPage: 10) { media(type: ANIME, format: MOVIE, sort: SCORE_DESC, isAdult: false) { id title { romaji english } description bannerImage coverImage { extraLarge } genres averageScore duration episodes format seasonYear status } } }`,
  action: `query { Page(page: 1, perPage: 12) { media(type: ANIME, genre: "Action", sort: POPULARITY_DESC, isAdult: false) { id title { romaji english } description bannerImage coverImage { extraLarge } genres averageScore duration episodes format seasonYear status } } }`,
};

async function gql(query) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const out = {};
for (const [key, query] of Object.entries(QUERIES)) {
  console.log(`Fetching ${key}...`);
  const data = await gql(query);
  const list = (data.Page?.media || []).map((m) => ({
    id: m.id,
    title: (m.title?.english || m.title?.romaji || "").trim(),
    romaji: m.title?.romaji || "",
    description: (m.description || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(),
    bannerImage: m.bannerImage || "",
    coverImage: m.coverImage?.extraLarge || "",
    genres: m.genres || [],
    averageScore: m.averageScore || 0,
    duration: m.duration || 0,
    episodes: m.episodes || 0,
    format: m.format || "",
    seasonYear: m.seasonYear || 0,
    status: m.status || "",
  }));
  out[key] = list;
  await sleep(400);
}

const fs = await import("node:fs");
fs.writeFileSync(
  new URL("../src/data/anime.json", import.meta.url),
  JSON.stringify(out, null, 2)
);
console.log("Saved src/data/anime.json");
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
