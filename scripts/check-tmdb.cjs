import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  const consoleErrs = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
  p.on("console", (m) => {
    if (m.type() === "error") consoleErrs.push(m.text().slice(0, 150));
  });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(3000);

  const card = p.locator('a[href="/anime/1"]').first();
  await card.scrollIntoViewIfNeeded();
  await p.waitForTimeout(2500);
  console.log("Demon Slayer card visible:", await card.isVisible());
  const img = card.locator("img").first();
  const src = await img.getAttribute("src").catch(() => null);
  console.log("card img src:", src);
  const loaded = await img
    .evaluate((el) => el.complete && el.naturalWidth > 0)
    .catch(() => false);
  console.log("image actually loaded:", loaded);

  console.log("page errors:", errors.length ? errors : "none");
  console.log("console errors:", consoleErrs.length ? consoleErrs : "none");
  await b.close();
});
