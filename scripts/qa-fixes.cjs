import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });

  console.log("=== HERO LOCK ===");
  for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 720], [430, 932], [390, 844]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const hero = document.getElementById("hero");
      const rect = hero.getBoundingClientRect();
      return {
        heroH: Math.round(rect.height),
        viewportH: window.innerHeight,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    const fills = Math.abs(r.heroH - r.viewportH) <= Math.max(1, r.viewportH * 0.15);
    console.log(`${w}x${h}: hero=${r.heroH} viewport=${r.viewportH} fills=${fills} overflow=${r.overflow}`);
    await p.close();
  }

  console.log("=== HERO SCROLL BEHAVIOR (1366) ===");
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }));
  await p.waitForTimeout(400);
  const s1 = await p.evaluate(() => {
    const hero = document.getElementById("hero");
    const main = document.querySelector("main");
    return {
      heroTop: Math.round(hero.getBoundingClientRect().top),
      mainTop: Math.round(main.getBoundingClientRect().top),
      heroVisible: hero.getBoundingClientRect().bottom > 0,
    };
  });
  console.log("scrolled 500px: heroTop=" + s1.heroTop + " mainTop=" + s1.mainTop + " (hero moving away naturally)");

  await p.evaluate(() => window.scrollTo({ top: 2000, behavior: "instant" }));
  await p.waitForTimeout(400);
  const s2 = await p.evaluate(() => {
    const hero = document.getElementById("hero");
    return { heroGone: hero.getBoundingClientRect().bottom < 0 };
  });
  console.log("scrolled 2000px: hero fully scrolled away =", s2.heroGone);
  await p.close();

  console.log("=== SEARCH FLOW (1366) ===");
  const q = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  q.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
  await q.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await q.waitForTimeout(2500);

  const input = q.locator('input[aria-label="Search anime"]').first();
  console.log("search icon visible:", await q.locator('svg').first().isVisible());

  await input.fill("witch");
  await q.waitForTimeout(1200);
  const results = q.locator("a[href^='/anime/']", { hasText: "Witch" });
  console.log("dropdown results for 'witch':", await results.count());
  console.log("first result text:", (await results.first().textContent()).slice(0, 60));

  await input.fill(" WITCH ");
  await q.waitForTimeout(1200);
  console.log("case/whitespace-insensitive results:", await q.locator("a[href^='/anime/']", { hasText: "Witch" }).count());

  await input.fill("zzzzzznothing");
  await q.waitForTimeout(1200);
  console.log("no-results message:", await q.locator("text=No anime found for").isVisible());

  await input.fill("witch");
  await q.waitForTimeout(1200);
  await input.press("Enter");
  await q.waitForURL("**/search?q=**", { timeout: 10000 });
  await q.waitForTimeout(2000);
  console.log("enter navigated to:", q.url());
  console.log("search page cards:", await q.locator("a[href^='/anime/']").count());

  await q.locator("a[href^='/anime/']").first().click();
  await q.waitForURL("**/anime/**", { timeout: 10000 });
  console.log("clicked result -> detail page:", q.url());

  console.log("errors:", errors.length ? errors : "none");
  await q.close();

  console.log("=== MOBILE DRAWER SEARCH (390) ===");
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await m.waitForTimeout(2500);
  await m.locator('button[aria-label="Open menu"]').click();
  await m.waitForTimeout(600);
  const mInput = m.locator('input[aria-label="Search anime"]:visible');
  await mInput.fill("bleach");
  await m.waitForTimeout(1200);
  console.log("mobile dropdown results:", await m.locator("a[href^='/anime/']", { hasText: "BLEACH" }).count());
  console.log("mobile no overflow:", await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await m.close();

  await b.close();
});
