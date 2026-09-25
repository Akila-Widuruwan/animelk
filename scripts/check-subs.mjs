import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const h = { apikey: anon, Authorization: `Bearer ${anon}` };

const r = await fetch(
  `${url}/rest/v1/episodes?select=id,anime_id,episode_number,video_url,subtitles&limit=20`,
  { headers: h }
);
console.log("episodes status:", r.status);
const rows = await r.json();
if (!Array.isArray(rows)) {
  console.log(JSON.stringify(rows).slice(0, 300));
} else {
  console.log("episodes:", rows.length);
  for (const e of rows) {
    console.log(
      `id=${e.id} anime=${e.anime_id} ep=${e.episode_number} | subs=${JSON.stringify(e.subtitles)} | video=${(e.video_url || "").slice(0, 60)}`
    );
  }
}

const r2 = await fetch(`${url}/storage/v1/bucket/subtitles`, { headers: h });
console.log("\nbucket status:", r2.status, (await r2.text()).slice(0, 200));
