import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));

  await p.goto("http://localhost:3000/anime/1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(2000);
  console.log("started on detail page:", p.url());

  await p.locator("header nav a", { hasText: "Genres" }).click();
  await p.waitForURL("**/#categories", { timeout: 10000 });
  await p.waitForTimeout(1500);
  const nearCategories = await p.evaluate(() => {
    const el = document.getElementById("categories");
    return Math.abs(el.getBoundingClientRect().top) < 250;
  });
  console.log("Genres from detail -> landed home near categories:", nearCategories);

  await p.locator("header nav a", { hasText: "Home" }).click();
  await p.waitForTimeout(1500);
  console.log("Home -> back to top:", await p.evaluate(() => window.scrollY < 100));

  console.log("page errors:", errors.length ? errors : "none");
  await b.close();
});
