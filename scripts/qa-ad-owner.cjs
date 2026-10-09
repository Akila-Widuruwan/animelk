/**
 * Checks the owner-account ad switch in public/ad-gate.js against the built app.
 *
 *   node scripts/qa-ad-owner.cjs [baseUrl]
 *
 * Chrome is driven directly because Playwright's own browsers are not installed
 * on this machine. The planted "session" uses the storage key the real Supabase
 * client derives for this project's URL (checked for real in case 5), so the
 * gate is exercised against the same localStorage shape a signed-in visitor has.
 */
const { existsSync, readFileSync } = require("fs");

const BASE = process.argv[2] || "http://127.0.0.1:3100";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OWNER = "akilawiduruwan@gmail.com";
const OTHER = "someone.else@example.com";
/** A third address the admin panel added, used to check the cache is per-account. */
const LISTED = "listed.by.admin@example.com";
const AD_HOSTS = [
  "quge5.com",
  "6opo.com",
  "auqot.com",
  "b3mny.com",
  "ekhay.com",
  "jmosl.com",
  "094kk.com",
];

function envValue(name) {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (match && match[1] === name) {
        return match[2].replace(/^["']|["']$/g, "").trim();
      }
    }
  }
  return null;
}

/** The key the app and the gate must agree on, read straight from the source. */
const AD_OFF_KEY = (() => {
  const source = readFileSync("src/lib/ad-free.ts", "utf8");
  const match = /AD_FREE_CACHE_KEY\s*=\s*"([^"]+)"/.exec(source);
  return match ? match[1] : null;
})();

/** What @/lib/ad-free writes: the address plus the moment it stops being trusted. */
const adOff = (email, until = Date.now() + 12 * 60 * 60 * 1000) =>
  JSON.stringify({ email, until });

const SUPABASE_URL = envValue("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const PROJECT_REF = SUPABASE_URL ? new URL(SUPABASE_URL).hostname.split(".")[0] : null;
const STORAGE_KEY = PROJECT_REF ? `sb-${PROJECT_REF}-auth-token` : null;

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
};

const adRequests = (requests) =>
  requests.filter((u) => AD_HOSTS.some((h) => u.includes(h)));

/** The JSON Supabase persists: a session object with the user inside it. */
const session = (email) =>
  JSON.stringify({
    access_token: "test.access.token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "test-refresh-token",
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      aud: "authenticated",
      role: "authenticated",
      email,
      email_verified: true,
      user_metadata: { full_name: email.split("@")[0], picture: null },
    },
  });

const adState = (page) =>
  page.evaluate(() => ({
    gate: !!window.__adGate,
    adFree: window.__adGate ? window.__adGate.adFree() : null,
    sessionEmail: window.__adGate ? window.__adGate.sessionEmail() : null,
    tagCount: document.querySelectorAll('script[id="monetag-tag"]').length,
    tagInHead: [...document.querySelectorAll('script[id="monetag-tag"]')].every(
      (s) => s.parentElement.tagName === "HEAD"
    ),
  }));

import("playwright").then(async ({ chromium }) => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  check(
    "setup: session key derived from this project's Supabase URL",
    /^sb-.+-auth-token$/.test(STORAGE_KEY || ""),
    STORAGE_KEY || "no NEXT_PUBLIC_SUPABASE_URL in .env.local"
  );
  check(
    "setup: ad-free cache key read from src/lib/ad-free.ts",
    AD_OFF_KEY === "animelk:ads-off",
    String(AD_OFF_KEY)
  );

  // --- 1. signed out: the tag still loads ------------------------------------
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);

    const state = await adState(page);
    check("signed out: gate script runs", state.gate);
    check("signed out: reads no session", state.sessionEmail === null, `${state.sessionEmail}`);
    check("signed out: not ad-free", state.adFree === false);
    check("signed out: Monetag tag injected", state.tagCount === 1);
    check(
      "signed out: the ad network really was called",
      adRequests(requests).length > 0,
      adRequests(requests).slice(0, 2).join(", ")
    );
    await context.close();
  }

  // --- 2. the owner's own account gets nothing -------------------------------
  {
    const context = await browser.newContext();
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [STORAGE_KEY, session(OWNER)]
    );
    const page = await context.newPage();
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);

    const state = await adState(page);
    check("owner: gate script runs", state.gate);
    check("owner: session read from storage", state.sessionEmail === OWNER, `${state.sessionEmail}`);
    check("owner: reported as ad-free", state.adFree === true);
    check("owner: no Monetag tag in the DOM", state.tagCount === 0);
    check(
      "owner: not one ad request left the browser",
      adRequests(requests).length === 0,
      adRequests(requests).join(", ")
    );

    const hidden = await page.evaluate(async () => {
      const unit = document.createElement("div");
      unit.style.cssText =
        "position:fixed;bottom:8px;right:8px;width:300px;height:80px;z-index:2147483647";
      document.body.appendChild(unit);
      await new Promise((resolve) => setTimeout(resolve, 300));
      return getComputedStyle(unit).display;
    });
    check("owner: an overlay unit that arrives later is hidden", hidden === "none", `display=${hidden}`);
    await context.close();
  }

  // --- 3. anybody else still gets ads ---------------------------------------
  {
    const context = await browser.newContext();
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [STORAGE_KEY, session(OTHER)]
    );
    const page = await context.newPage();
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);

    const state = await adState(page);
    check("other account: session read from storage", state.sessionEmail === OTHER, `${state.sessionEmail}`);
    check("other account: not ad-free", state.adFree === false);
    check("other account: Monetag tag injected", state.tagCount === 1 && state.tagInHead);
    check(
      "other account: the ad network really was called",
      adRequests(requests).length > 0,
      adRequests(requests).slice(0, 2).join(", ")
    );
    await context.close();
  }

  // --- 3b. an account the admin panel listed is ad-free too -----------------
  {
    const context = await browser.newContext();
    await context.addInitScript(
      ([key, value, cacheKey, cacheValue]) => {
        window.localStorage.setItem(key, value);
        window.localStorage.setItem(cacheKey, cacheValue);
      },
      [STORAGE_KEY, session(LISTED), AD_OFF_KEY, adOff(LISTED)]
    );
    const page = await context.newPage();
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);

    const state = await page.evaluate(() => ({
      gate: !!window.__adGate,
      key: window.__adGate ? window.__adGate.adFreeKey : null,
      cached: window.__adGate ? window.__adGate.cachedAdFree() : null,
      adFree: window.__adGate ? window.__adGate.adFree() : null,
      tagCount: document.querySelectorAll('script[id="monetag-tag"]').length,
    }));
    check("listed account: gate reads the same cache key", state.key === AD_OFF_KEY, `${state.key}`);
    check("listed account: cached answer is read", state.cached === LISTED, `${state.cached}`);
    check("listed account: reported as ad-free", state.adFree === true);
    check("listed account: no Monetag tag in the DOM", state.tagCount === 0);
    check(
      "listed account: not one ad request left the browser",
      adRequests(requests).length === 0,
      adRequests(requests).join(", ")
    );
    await context.close();
  }

  // --- 3c. a stale or mismatched cache never suppresses ads ------------------
  {
    const context = await browser.newContext();
    await context.addInitScript(
      ([key, value, cacheKey, cacheValue]) => {
        window.localStorage.setItem(key, value);
        window.localStorage.setItem(cacheKey, cacheValue);
      },
      [STORAGE_KEY, session(OTHER), AD_OFF_KEY, adOff(OTHER, Date.now() - 1000)]
    );
    const page = await context.newPage();
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);

    const state = await page.evaluate(() => ({
      cached: window.__adGate ? window.__adGate.cachedAdFree() : null,
      adFree: window.__adGate ? window.__adGate.adFree() : null,
      tagCount: document.querySelectorAll('script[id="monetag-tag"]').length,
    }));
    check("expired cache: ignored", state.cached === null, `${state.cached}`);
    check("expired cache: not ad-free", state.adFree === false);
    check("expired cache: Monetag tag injected", state.tagCount === 1);
    check(
      "expired cache: the ad network really was called",
      adRequests(requests).length > 0,
      adRequests(requests).slice(0, 2).join(", ")
    );
    await context.close();
  }

  {
    const context = await browser.newContext();
    await context.addInitScript(
      ([key, value, cacheKey, cacheValue]) => {
        window.localStorage.setItem(key, value);
        window.localStorage.setItem(cacheKey, cacheValue);
      },
      [STORAGE_KEY, session(OTHER), AD_OFF_KEY, adOff(LISTED)]
    );
    const page = await context.newPage();
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);

    const state = await page.evaluate(() => ({
      adFree: window.__adGate ? window.__adGate.adFree() : null,
      tagCount: document.querySelectorAll('script[id="monetag-tag"]').length,
    }));
    check(
      "cache for another address: does not leak to this one",
      state.adFree === false
    );
    check("cache for another address: Monetag tag injected", state.tagCount === 1);
    check(
      "cache for another address: the ad network really was called",
      adRequests(requests).length > 0,
      adRequests(requests).slice(0, 2).join(", ")
    );
    await context.close();
  }

  // --- 4. the Google return page, where the session lands a moment late ------
  {
    const context = await browser.newContext();
    await context.addInitScript(
      ([key, value]) => {
        // Supabase redeems the code shortly after the document starts loading.
        setTimeout(() => window.localStorage.setItem(key, value), 800);
      },
      [STORAGE_KEY, session(OWNER)]
    );
    const page = await context.newPage();
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(BASE + "/login?code=test-oauth-code&next=%2F", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(7000);

    const state = await adState(page);
    check("oauth return: session read after the callback", state.sessionEmail === OWNER, `${state.sessionEmail}`);
    check("oauth return: reported as ad-free", state.adFree === true);
    check("oauth return: no Monetag tag in the DOM", state.tagCount === 0);
    check(
      "oauth return: not one ad request left the browser",
      adRequests(requests).length === 0,
      adRequests(requests).join(", ")
    );
    await context.close();
  }

  // --- 5. the storage key is the one the real Supabase client uses -----------
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    // /ad-gate.js is an async head script, so give it a moment to run.
    await page.waitForFunction(() => window.__adGate, null, { timeout: 20000 });
    await page.addScriptTag({
      content: readFileSync(
        "node_modules/@supabase/supabase-js/dist/umd/supabase.js",
        "utf8"
      ),
    });
    const live = await page.evaluate(
      ([url, anon]) => {
        const client = window.supabase.createClient(url, anon);
        return { storageKey: client.auth.storageKey };
      },
      [SUPABASE_URL, SUPABASE_ANON_KEY]
    );
    check(
      "real client: writes the same key the gate reads",
      live.storageKey === STORAGE_KEY,
      `${live.storageKey} vs ${STORAGE_KEY}`
    );

    // And the planted value really is what the client would have written there.
    const roundTrip = await page.evaluate(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
        return window.__adGate.sessionEmail();
      },
      [STORAGE_KEY, session(OWNER)]
    );
    check("real key: gate resolves the planted owner session", roundTrip === OWNER, `${roundTrip}`);
    await context.close();
  }

  // --- 6. the tag's push worker is dropped for the owner --------------------
  {
    const context = await browser.newContext();
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [STORAGE_KEY, session(OWNER)]
    );
    const page = await context.newPage();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });

    const registered = await page.evaluate(async () => {
      const urls = async () =>
        (await navigator.serviceWorker.getRegistrations()).map(
          (r) =>
            (r.active && r.active.scriptURL) ||
            (r.waiting && r.waiting.scriptURL) ||
            (r.installing && r.installing.scriptURL) ||
            ""
        );
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // The worker is still installing right after register() resolves.
        for (let i = 0; i < 30; i++) {
          const now = await urls();
          if (now.some((u) => u && u.endsWith("/sw.js"))) return now;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        return await urls();
      } catch (e) {
        return "error: " + e.message;
      }
    });
    if (typeof registered === "string") {
      console.log(`SKIP  push worker: could not register /sw.js locally  — ${registered}`);
    } else {
      check(
        "push worker: registered before the owner load",
        registered.some((u) => u && u.endsWith("/sw.js")),
        JSON.stringify(registered)
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      const left = await page.evaluate(async () =>
        (await navigator.serviceWorker.getRegistrations()).map(
          (r) => (r.active && r.active.scriptURL) || (r.installing && r.installing.scriptURL) || ""
        )
      );
      check(
        "push worker: unregistered for the owner",
        !left.some((u) => u && u.endsWith("/sw.js")),
        JSON.stringify(left)
      );
    }
    await context.close();
  }

  await browser.close();
  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
});
