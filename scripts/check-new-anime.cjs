import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(3000);

  const browseVisible = await p
    .locator("text=Demon Slayer: Kimetsu No Yaiba The Movie")
    .first()
    .isVisible();
  console.log("new anime visible on homepage:", browseVisible);

  const detailLink = await p
    .locator('a[href="/anime/1"]')
    .first()
    .isVisible();
  console.log("card links to /anime/1:", detailLink);

  console.log("page errors:", errors.length ? errors : "none");
  await b.close();
});
