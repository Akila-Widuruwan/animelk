import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

  await p.goto("http://localhost:3000/anime/1/watch?ep=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(2500);

  console.log("iframe player:", await p.locator("iframe").count());
  console.log("embed subtitle notice:", await p.locator("text=embed players").isVisible());

  console.log("page errors:", errors.length ? errors : "none");
  await b.close();
});
