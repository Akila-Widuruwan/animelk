import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const h = { apikey: anon, Authorization: `Bearer ${anon}` };

const count = await fetch(`${url}/rest/v1/anime?select=id`, { headers: h });
const rows = await count.json();
console.log("total anime in DB:", Array.isArray(rows) ? rows.length : rows);

const find = await fetch(
  `${url}/rest/v1/anime?select=id,title&id=in.(196187,189046,21,20,199)&limit=10`,
  { headers: h }
);
console.log("lookup:", (await find.text()).slice(0, 500));

const sec = await fetch(`${url}/rest/v1/sections?select=slug,title&order=sort_order`, { headers: h });
console.log("sections:", (await sec.text()).slice(0, 400));

const hero = await fetch(`${url}/rest/v1/hero_slides?select=position,anime_id&limit=8`, { headers: h });
console.log("hero slides:", (await hero.text()).slice(0, 300));
