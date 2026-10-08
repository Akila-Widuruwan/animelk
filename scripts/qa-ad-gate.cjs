/**
 * Checks the ten-minute ad cooldown in public/ad-gate.js against the built app.
 *
 *   node scripts/qa-ad-gate.cjs [baseUrl]
 *
 * Chrome is driven directly because Playwright's own browsers are not installed
 * on this machine.
 */
const BASE = process.argv[2] || "http://127.0.0.1:3100";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const MUTE_KEY = "animelk:ads-muted-until";
const AD_HOSTS = [
  "quge5.com",
  "6opo.com",
  "auqot.com",
  "b3mny.com",
  "ekhay.com",
  "jmosl.com",
  "094kk.com",
];

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
};

const adRequests = (requests) =>
  requests.filter((u) => AD_HOSTS.some((h) => u.includes(h)));

import("playwright").then(async ({ chromium }) => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  // --- 1. a visitor with no cooldown gets ads --------------------------------
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);

    const state = await page.evaluate(() => {
      const tag = document.querySelector('script[id="monetag-tag"]');
      return {
        gate: !!window.__adGate,
        muted: window.__adGate ? window.__adGate.muted() : null,
        tag: tag
          ? {
              src: tag.src,
              zone: tag.dataset.zone,
              cfasync: tag.getAttribute("data-cfasync"),
              inHead: tag.parentElement.tagName === "HEAD",
            }
          : null,
      };
    });

    check("clean visitor: gate script runs", state.gate);
    check("clean visitor: not muted", state.muted === false);
    check("clean visitor: Monetag tag injected", !!state.tag);
    check("clean visitor: tag is in <head>", state.tag?.inHead === true);
    check(
      "clean visitor: tag carries zone + upstream",
      state.tag?.zone === "292661" &&
        state.tag?.src === "https://quge5.com/88/tag.min.js",
      JSON.stringify(state.tag)
    );
    check("clean visitor: data-cfasync kept", state.tag?.cfasync === "false");
    check(
      "clean visitor: the ad network really was called",
      adRequests(requests).length > 0,
      adRequests(requests).slice(0, 3).join(", ")
    );
    await context.close();
  }

  // --- 2. a visitor inside the cooldown gets none ----------------------------
  {
    const context = await browser.newContext();
    await context.addInitScript(
      ([key]) => {
        const until = Date.now() + 10 * 60 * 1000;
        window.localStorage.setItem(key, String(until));
        window.__plantedMuteUntil = until;
      },
      [MUTE_KEY]
    );
    const page = await context.newPage();
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);

    const state = await page.evaluate(() => ({
      gate: !!window.__adGate,
      muted: window.__adGate ? window.__adGate.muted() : null,
      minutesLeft: window.__adGate
        ? Math.round((window.__adGate.mutedUntil() - Date.now()) / 60000)
        : null,
      tagCount: document.querySelectorAll('script[id="monetag-tag"]').length,
      quge5Count: [...document.querySelectorAll("script")].filter((s) =>
        s.src.includes("quge5")
      ).length,
    }));

    check("cooling down: gate script runs", state.gate);
    check("cooling down: reports muted", state.muted === true);
    check(
      "cooling down: about ten minutes left",
      state.minutesLeft >= 9 && state.minutesLeft <= 10,
      `${state.minutesLeft} min`
    );
    check("cooling down: no Monetag tag in the DOM", state.tagCount === 0);
    check("cooling down: no Monetag script element", state.quge5Count === 0);
    check(
      "cooling down: not one ad request left the browser",
      adRequests(requests).length === 0,
      adRequests(requests).join(", ")
    );

    // --- 3. units already on the page are hidden, ours are left alone --------
    const hidden = await page.evaluate(() => {
      const unit = document.createElement("div");
      unit.style.cssText =
        "position:fixed;top:8px;right:8px;width:300px;height:80px;z-index:2147483647";
      document.body.appendChild(unit);
      const portal = document.createElement("div");
      portal.setAttribute("data-movi-menu-portal", "");
      portal.style.cssText =
        "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647";
      document.body.appendChild(portal);
      return new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              unit: getComputedStyle(unit).display,
              portal: getComputedStyle(portal).display,
            }),
          300
        )
      );
    });
    check(
      "cooling down: overlay unit is hidden",
      hidden.unit === "none",
      `display=${hidden.unit}`
    );
    check(
      "cooling down: the player's own portal is untouched",
      hidden.portal !== "none",
      `display=${hidden.portal}`
    );
    await context.close();
  }

  // --- 4. an ad that opens a window starts the cooldown ----------------------
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);

    const state = await page.evaluate(async () => {
      window.__adGate.clear();
      const before = window.__adGate.muted();
      try {
        window.open("about:blank", "_blank");
      } catch (e) {
        /* popup blocked; the cooldown should still be recorded */
      }
      const stored = window.localStorage.getItem("animelk:ads-muted-until");
      return {
        before,
        after: window.__adGate.muted(),
        minutes: stored ? Math.round((Number(stored) - Date.now()) / 60000) : null,
      };
    });

    check("ad click: not muted beforehand", state.before === false);
    check("ad click: muted afterwards", state.after === true);
    check(
      "ad click: ten minutes recorded",
      state.minutes >= 9 && state.minutes <= 10,
      `${state.minutes} min`
    );
    await context.close();
  }

  await browser.close();
  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
});
