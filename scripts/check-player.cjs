import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  const consoleErrs = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  p.on("console", (m) => {
    if (m.type() === "error") consoleErrs.push(m.text().slice(0, 200));
  });

  console.log("=== ONE PIECE (id 21) ep1 - embed URL ===");
  await p.goto("http://localhost:3000/anime/21/watch?ep=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(2500);
  console.log("h1:", (await p.locator("h1").first().textContent()).trim());
  console.log("iframe player count:", await p.locator("iframe").count());
  const src = await p.locator("iframe").first().getAttribute("src");
  console.log("iframe src:", src);
  console.log("episode title shown:", await p.locator("text=Episode 1").first().isVisible());
  console.log("green dot hint:", await p.locator("text=green dot").isVisible());

  console.log("=== ONE PIECE ep3 - no video row ===");
  await p.goto("http://localhost:3000/anime/21/watch?ep=3", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(1500);
  console.log("no-video message:", await p.locator("text=No video uploaded").isVisible());
  console.log("iframe count (should be 0):", await p.locator("iframe").count());

  console.log("=== Naruto (id 20) ep1 - embed URL ===");
  await p.goto("http://localhost:3000/anime/20/watch?ep=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(1500);
  console.log("iframe count:", await p.locator("iframe").count());

  console.log("page errors:", errors.length ? errors : "none");
  console.log("console errors:", consoleErrs.length ? consoleErrs : "none");
  await b.close();
});
