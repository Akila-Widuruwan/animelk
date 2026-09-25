import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await m.waitForTimeout(2500);
  await m.locator('button[aria-label="Open menu"]').click();
  await m.waitForTimeout(600);
  const mInput = m.locator('input[aria-label="Search anime"]:visible');
  await mInput.fill("bleach");
  await m.waitForTimeout(1200);
  console.log("mobile dropdown results:", await m.locator("a[href^='/anime/']", { hasText: "BLEACH" }).count());
  console.log("mobile no overflow:", await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  await mInput.press("Enter");
  await m.waitForURL("**/search?q=**", { timeout: 10000 });
  await m.waitForTimeout(1500);
  console.log("mobile enter -> search page:", m.url());
  console.log("mobile search page overflow:", await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await b.close();
});
