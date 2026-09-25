import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(4000);

  const countTitle = async (sectionTitle, animeTitle) => {
    const section = p.locator("section", { has: p.locator(`h5:text("${sectionTitle}")`) }).first();
    const cardCount = await section.locator("a[href^='/anime/']").count();
    const hasAnime = await section.locator(`text=${animeTitle}`).first().isVisible().catch(() => false);
    return { cardCount, hasAnime };
  };

  const ns = await countTitle("New Anime Series", "Demon Slayer");
  console.log("New Anime Series: cards =", ns.cardCount, "| shows Demon Slayer =", ns.hasAnime);

  const nn = await countTitle("New Anime", "Witch Hat Atelier");
  console.log("New Anime: cards =", nn.cardCount, "| shows Witch Hat Atelier =", nn.hasAnime);

  const tp = await countTitle("Top 10 Anime Series Today", "BLEACH");
  console.log("Top 10 Series: cards =", tp.cardCount, "| shows BLEACH =", tp.hasAnime);

  console.log("page errors:", errors.length ? errors : "none");
  await b.close();
});
