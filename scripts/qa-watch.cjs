import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });

  console.log("=== WATCH PAGE LAYOUT (Witch Hat Atelier, TV, 13 eps) ===");
  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [430, 932], [390, 844]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    p.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
    await p.goto("http://localhost:3000/anime/2/watch?ep=1", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const player = document.querySelector("iframe, video");
      const sidebar = document.querySelector("aside");
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      const info = document.querySelector("h1");
      const cards = document.querySelectorAll("a[href^='/anime/']").length;
      let pw = 0, ph = 0;
      if (player) {
        const rect = player.getBoundingClientRect();
        pw = Math.round(rect.width);
        ph = Math.round(rect.height);
      }
      return {
        pw, ph, ratio16x9: ph > 0 ? Math.abs(pw / ph - 16 / 9) < 0.02 : false,
        sidebar: !!sidebar && getComputedStyle(sidebar).display !== "none",
        overflow,
        title: info ? info.textContent.trim().slice(0, 40) : "",
        cards,
      };
    });
    console.log(
      `${w}x${h}: player=${r.pw}x${r.ph} 16:9=${r.ratio16x9} sidebar=${r.sidebar} overflow=${r.overflow} title="${r.title}" cards=${r.cards} errors=${errors.length}`
    );
    await p.close();
  }

  console.log("=== FUNCTIONAL FLOW (1366) ===");
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto("http://localhost:3000/anime/2/watch?ep=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(2500);

  console.log("breadcrumb visible:", await p.locator("nav[aria-label=Breadcrumb]").isVisible());
  console.log("active ep highlighted:", await p.locator('a[aria-current="true"]').first().isVisible());
  console.log("episode count badge:", await p.locator("aside >> text=13").first().isVisible());

  await p.locator('aside a[href*="watch?ep=3"]').first().click();
  await p.waitForURL("**/watch?ep=3", { timeout: 10000 });
  await p.waitForTimeout(1500);
  console.log("sidebar ep switch -> URL:", p.url());
  console.log("breadcrumb shows Episode 3:", await p.locator("text=Episode 3").first().isVisible());

  console.log("next card visible:", await p.locator("a[href*='watch?ep=4']", { hasText: "Next" }).isVisible());
  await p.locator("a[href*='watch?ep=4']", { hasText: "Next" }).first().click();
  await p.waitForURL("**/watch?ep=4", { timeout: 10000 });
  console.log("next button -> ep4:", p.url());

  await p.goto("http://localhost:3000/anime/2/watch?ep=4", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(1500);
  console.log("prev card visible:", await p.locator("a[href*='watch?ep=3']", { hasText: "Previous" }).isVisible());

  console.log("More Like This:", await p.locator("text=More Like This").isVisible());
  console.log("Popular on AniLanka:", await p.locator("text=Popular on AniLanka").isVisible());
  console.log("Add to List:", await p.locator("text=Add to List").isVisible());
  console.log("Share:", await p.locator("text=Share").first().isVisible());
  await p.close();

  console.log("=== MOVIE VARIANT (Demon Slayer) ===");
  const m = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await m.goto("http://localhost:3000/anime/1/watch", { waitUntil: "domcontentloaded", timeout: 60000 });
  await m.waitForTimeout(2000);
  console.log("movie: no episode sidebar:", (await m.locator("aside").count()) === 0);
  console.log("movie: Full Movie label:", await m.locator("text=Full Movie").isVisible());
  await m.close();

  await b.close();
});
