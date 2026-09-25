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

  console.log("no CC button:", (await p.locator("button", { hasText: "CC" }).count()) === 0);
  console.log("no control bar buttons:", (await p.locator("button").count()) === 0);

  await p.locator("iframe").first().click({ position: { x: 400, y: 200 } });
  await p.waitForTimeout(6000);

  const subtitle = await p.locator("p.whitespace-pre-line").count();
  console.log("subtitle auto-appeared after play click:", subtitle > 0);

  await p.mouse.click(20, 850);
  await p.waitForTimeout(500);
  const stillShown = await p.locator("p.whitespace-pre-line").isVisible().catch(() => false);
  console.log("paused on outside click (subtitle hidden):", !stillShown);

  console.log("page errors:", errors.length ? errors : "none");
  await b.close();
});
