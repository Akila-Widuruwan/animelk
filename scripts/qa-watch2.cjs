import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));

  await p.goto("http://localhost:3000/anime/2/watch?ep=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(3000);

  console.log("active ep visible:", await p.locator('a[aria-current="true"]:visible').count() > 0);
  console.log("More Like This:", await p.locator("text=More Like This").isVisible());
  console.log("More Like This cards:", await p.locator("section:has(h5:text('More Like This')) a[href^='/anime/']").count());
  console.log("Popular on AniLanka:", await p.locator("text=Popular on AniLanka").isVisible());

  await p.locator("text=Add to List").click();
  await p.waitForTimeout(300);
  console.log("watchlist toggled to 'In Your List':", await p.locator("text=In Your List").isVisible());

  await p.locator("text=Read more").click().catch(() => {});
  await p.waitForTimeout(300);
  console.log("read more/less button present:", (await p.locator("text=Read more").count()) + (await p.locator("text=Show less").count()) > 0);

  console.log("page errors:", errors.length ? errors : "none");
  await b.close();
});
