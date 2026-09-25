import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const h = { apikey: anon, Authorization: `Bearer ${anon}` };

for (const t of ["genres", "topics", "menu_items", "section_items", "hero_slides", "episodes", "settings"]) {
  const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=0`, {
    headers: { ...h, Prefer: "count=exact", Range: "0-0" },
  });
  const range = r.headers.get("content-range") ?? "";
  console.log(`${t}: ${range.split("/")[1] ?? "?"} rows`);
}
