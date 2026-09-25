import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

  await p.goto("http://localhost:3000/anime/1", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(2500);

  console.log("trailer button visible:", await p.locator("text=Watch Trailer").isVisible());
  await p.locator("text=Watch Trailer").click();
  await p.waitForTimeout(1500);

  const iframe = p.locator("iframe[title=Trailer]");
  console.log("modal iframe count:", await iframe.count());
  const src = await iframe.first().getAttribute("src");
  console.log("embed src:", src);
  console.log("correct video id (x7uLutVRBfI):", (src ?? "").includes("x7uLutVRBfI"));

  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);
  console.log("closed on Escape:", (await iframe.count()) === 0);

  console.log("page errors:", errors.length ? errors : "none");
  await b.close();
});
