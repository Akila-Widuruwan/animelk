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

  await mInput.fill("witch");
  await m.waitForTimeout(1500);
  console.log("drawer 'witch' results:", await m.locator("a[href^='/anime/']", { hasText: "Witch" }).count());

  await mInput.fill("zzzznope");
  await m.waitForTimeout(1500);
  console.log("drawer no-results msg:", await m.locator("text=No anime found for").isVisible());

  await mInput.fill("demon");
  await m.waitForTimeout(1500);
  const first = m.locator("a[href^='/anime/']", { hasText: "Demon Slayer" }).first();
  console.log("drawer 'demon' result:", await first.isVisible());
  await first.click();
  await m.waitForURL("**/anime/**", { timeout: 10000 });
  await m.waitForTimeout(1000);
  console.log("clicked drawer result -> detail:", m.url());
  console.log("drawer closed:", (await m.locator('button[aria-label="Close menu"]').count()) === 0);
  await b.close();
});
