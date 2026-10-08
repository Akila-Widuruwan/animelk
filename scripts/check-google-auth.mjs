/**
 * Checks the "Continue with Google" wiring in the order it can fail:
 *
 *   1. is the Google provider enabled on the Supabase project?
 *   2. does Supabase's /authorize hand off to Google with the right client?
 *   3. is the Supabase callback URI authorised on that Google OAuth client?
 *
 * Step 3 is the one that bites after the provider is switched on: Google only
 * accepts a redirect_uri that is registered verbatim on the OAuth client, and
 * Supabase always sends `https://<project-ref>.supabase.co/auth/v1/callback`.
 *
 * Usage:
 *   node scripts/check-google-auth.mjs [path-to-client_secret_*.json | client-id]
 *   GOOGLE_CLIENT_ID=... node scripts/check-google-auth.mjs
 *
 * The client id is public (it travels in every auth request); the client
 * secret is never read or printed. Without either argument the client id is
 * taken from the hand-off in step 2, which only works once the provider is on.
 *
 * Exits non-zero while anything is unproven, including "could not check".
 */
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim().replace(/\/$/, "");
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const projectRef = new URL(url).hostname.split(".")[0];
const callback = `${url}/auth/v1/callback`;
const site = "http://127.0.0.1:3000";
const problems = [];

function loadClientId(arg) {
  if (!arg) return process.env.GOOGLE_CLIENT_ID ?? "";
  if (arg.endsWith(".apps.googleusercontent.com")) return arg;
  if (!fs.existsSync(arg)) {
    throw new Error(
      `no such file: ${arg} (pass the client_secret JSON, or the client id itself)`
    );
  }
  const raw = fs.readFileSync(arg, "utf8");
  return JSON.parse(raw).web?.client_id ?? raw.trim();
}

/**
 * Google answers a bad redirect_uri by bouncing to an error page.
 * Returns {ok: true | false} or {ok: null} when Google could not be reached.
 */
async function probeGoogle(clientId, redirectUri) {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
  });
  try {
    const res = await fetch(
      `https://accounts.google.com/o/oauth2/v2/auth?${query}`,
      { redirect: "manual", headers: { "user-agent": "Mozilla/5.0" } }
    );
    const location = res.headers.get("location") ?? "";
    if (!/oauth\/error|error=/.test(location)) return { ok: true };

    const page = await fetch(location, { headers: { "user-agent": "Mozilla/5.0" } });
    const html = await page.text();
    const code = html.match(/redirect_uri_mismatch|invalid_client|invalid_request/);
    return { ok: false, reason: code?.[0] ?? `HTTP ${page.status}` };
  } catch (err) {
    return { ok: null, reason: err instanceof Error ? err.message : String(err) };
  }
}

console.log(`project:  ${projectRef}`);
console.log(`callback: ${callback}\n`);

// 1. Provider state, straight from the project's public auth settings.
const settings = await (await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
})).json();
const enabled = settings.external?.google === true;
console.log(`1. provider enabled in Supabase: ${enabled ? "yes" : "NO"}`);
if (!enabled) problems.push("Google provider is disabled in Supabase");

// 2. The hand-off the app's "Continue with Google" button causes.
const handoff = await fetch(
  `${url}/auth/v1/authorize?provider=google&redirect_to=` +
    encodeURIComponent(`${site}/login?next=%2Fmy-list`),
  { redirect: "manual", headers: { apikey: anon } }
);
let clientId = loadClientId(process.argv[2]);
if (!enabled) {
  const msg = (await handoff.text()).match(/"msg":"([^"]+)"/)?.[1];
  console.log(`2. /authorize hand-off: blocked: ${msg ?? handoff.status}`);
} else {
  const sent = new URL(handoff.headers.get("location") ?? "").searchParams;
  console.log(`2. /authorize hand-off: ${handoff.status} -> accounts.google.com`);
  console.log(`   sends client_id:    ${sent.get("client_id") ?? "(none)"}`);
  console.log(`   sends redirect_uri: ${sent.get("redirect_uri") ?? "(none)"}`);
  clientId = sent.get("client_id") || clientId;
  const sentBack = sent.get("redirect_uri");
  if (sentBack && sentBack !== callback) {
    problems.push(`Supabase sends redirect_uri ${sentBack}, expected ${callback}`);
  }
}

// 3. Is that callback registered on the Google client?
if (!clientId) {
  console.log(
    "\n3. callback registration: CANNOT CHECK — pass the client_secret JSON or GOOGLE_CLIENT_ID"
  );
  problems.push("The callback registration was never checked (no Google client id)");
} else {
  const verdict = await probeGoogle(clientId, callback);
  const label =
    verdict.ok === true ? "yes" : verdict.ok === false ? "NO" : "UNKNOWN";
  console.log(`\n3. Supabase callback registered on the Google client: ${label}`);
  if (verdict.ok === false) {
    console.log(`   Google says: ${verdict.reason}`);
    problems.push(
      `Google rejects ${callback} (${verdict.reason}) — add it to the OAuth client's ` +
        "Authorized redirect URIs in the Google Cloud Console"
    );
  } else if (verdict.ok === null) {
    console.log(`   could not reach accounts.google.com: ${verdict.reason}`);
    problems.push("Could not reach Google to check the callback — re-run when online");
  }
  const allowed = await probeGoogle(clientId, site);
  console.log(
    `   (site origin ${site} registered too: ${
      allowed.ok === true ? "yes" : allowed.ok === false ? "no" : "not checked"
    } — not needed for this flow)`
  );
}

if (problems.length) {
  console.log("\nstill to do:");
  for (const p of problems) console.log(` - ${p}`);
  process.exitCode = 1;
} else {
  console.log("\nwiring looks complete — finish with a real sign-in on /login");
}
