import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const r = await fetch(
  `${url}/rest/v1/episodes?select=anime_id,episode_number,title,video_url&video_url=not.is.null&limit=10`,
  { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }
);
console.log("episodes with video_url:", r.status);
console.log((await r.text()).slice(0, 800));

const r2 = await fetch(
  `${url}/rest/v1/anime?select=id,title,episodes_count&limit=3`,
  { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }
);
console.log("anime sample:", r2.status, (await r2.text()).slice(0, 400));
