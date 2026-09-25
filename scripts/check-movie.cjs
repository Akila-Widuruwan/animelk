import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));

  await p.goto("http://localhost:3000/anime/20954", { waitUntil: "networkidle", timeout: 90000 });
  console.log("movie h1:", (await p.locator("h1").first().textContent()).trim());
  console.log("watch CTA (movie):", await p.locator("text=Watch Now").isVisible());
  console.log("no episodes grid:", (await p.locator('a[href*="/watch?ep="]').count()) === 0);
  console.log("header solid:", await p.evaluate(() => getComputedStyle(document.querySelector("header")).position === "fixed"));

  await p.locator("text=Watch Now").click();
  await p.waitForURL("**/watch", { timeout: 10000 });
  console.log("movie watch URL:", p.url());
  console.log("no ep sidebar on movie:", (await p.locator('a[href*="watch?ep="]').count()) === 0);

  await p.goto("http://localhost:3000/anime/196187", { waitUntil: "networkidle", timeout: 90000 });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(600);
  console.log("mobile: no overflow:", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  console.log("page errors:", errors.length ? errors : "none");
  await b.close();
});
