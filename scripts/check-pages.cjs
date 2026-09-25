import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  const consoleErrs = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => {
    if (m.type() === "error") consoleErrs.push(m.text());
  });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(3000);

  await p.locator("a[href='/anime/1']").first().click();
  await p.waitForURL("**/anime/1", { timeout: 10000 });
  console.log("1. detail URL:", p.url());
  console.log("2. detail h1:", (await p.locator("h1").first().textContent()).trim());

  await p.locator("a[href='/anime/1/watch']").first().click();
  await p.waitForURL("**/watch", { timeout: 10000 });
  console.log("3. watch URL:", p.url());
  console.log("4. player/embed visible:", await p.locator("iframe, video").first().isVisible());

  console.log("page errors:", errors.length ? errors : "none");
  console.log("console errors:", consoleErrs.length ? consoleErrs : "none");
  await b.close();
});
