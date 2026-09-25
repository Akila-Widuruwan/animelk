const KEY = process.argv[2];
const REF = process.argv[3];

const r = await fetch(
  `https://${REF}.supabase.co/auth/v1/admin/users?per_page=1`,
  {
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY },
  }
);
console.log("auth users status:", r.status);
const text = await r.text();
console.log(text.slice(0, 200));

const r2 = await fetch(
  `https://${REF}.supabase.co/rest/v1/`,
  { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY } }
);
console.log("rest root status:", r2.status);
