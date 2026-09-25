import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const h = { apikey: anon, Authorization: `Bearer ${anon}` };

const r = await fetch(`${url}/rest/v1/section_items?select=section_id,anime_id,position&limit=50`, { headers: h });
console.log("section_items:", JSON.stringify(await r.json()));

const r2 = await fetch(`${url}/rest/v1/anime?select=id,title`, { headers: h });
console.log("anime:", JSON.stringify(await r2.json()));
