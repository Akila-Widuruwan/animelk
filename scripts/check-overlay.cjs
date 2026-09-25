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

  console.log("CC button visible:", await p.locator("button", { hasText: "CC" }).isVisible());
  await p.locator("button", { hasText: "CC" }).click();
  await p.waitForTimeout(500);
  console.log("Start button visible:", await p.locator("button", { hasText: "Start" }).isVisible());
  console.log("nudge buttons:", (await p.locator("button", { hasText: "-0.5s" }).count()) > 0);
  console.log("track select:", (await p.locator("select").count()) > 0);

  await p.locator("button", { hasText: "Start" }).click();
  await p.waitForTimeout(5000);
  const subtitle = await p.locator("p.whitespace-pre-line").count();
  console.log("subtitle overlay after 5s:", subtitle > 0 ? "SHOWING" : "not yet");

  console.log("page errors:", errors.length ? errors : "none");
  await b.close();
});
