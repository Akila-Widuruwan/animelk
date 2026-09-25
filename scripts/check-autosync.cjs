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

  await p.locator("button", { hasText: "CC" }).click();
  await p.waitForTimeout(600);
  console.log("waiting hint visible:", await p.locator("text=press play in the video").isVisible());
  console.log("start button visible:", await p.locator("button", { hasText: "Start" }).isVisible());

  // click inside the iframe (simulates pressing play in the embed)
  await p.locator("iframe").first().click({ position: { x: 400, y: 200 } });
  await p.waitForTimeout(6500);

  const overlay = await p.locator("p.whitespace-pre-line").count();
  console.log("auto-started on iframe click, subtitle showing:", overlay > 0);

  // click outside the player (page background) -> should pause
  await p.mouse.click(20, 850);
  await p.waitForTimeout(400);
  const pausedText = await p
    .locator("button", { hasText: "▶" })
    .count()
    .catch(() => 0);
  console.log("paused after clicking outside (resume ▶ button visible):", pausedText > 0);

  console.log("page errors:", errors.length ? errors : "none");
  await b.close();
});
