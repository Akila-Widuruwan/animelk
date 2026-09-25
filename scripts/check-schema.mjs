import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();

for (const table of [
  "anime",
  "genres",
  "episodes",
  "sections",
  "section_items",
  "hero_slides",
  "topics",
  "menu_items",
  "settings",
  "profiles",
]) {
  const r = await fetch(`${url}/rest/v1/${table}?limit=0&select=id`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  const text = await r.text();
  console.log(`${table}: status=${r.status} ${text.slice(0, 90)}`);
}
