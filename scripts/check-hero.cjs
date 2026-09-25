import("playwright").then(async ({ chromium }) => {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 90000 });

  const heroHeight = await page
    .locator("section.relative.h-dvh")
    .first()
    .evaluate((el) => el.getBoundingClientRect().height);
  console.log("hero height:", heroHeight, "viewport: 768");

  const title1 = await page.locator("section h2").first().textContent();
  await page.waitForTimeout(7000);
  const title2 = await page.locator("section h2").first().textContent();
  console.log("t=0s:", title1);
  console.log("t=7s:", title2);
  console.log("autoplay advanced:", title1 !== title2);

  await page.locator("section").first().hover();
  const t3 = await page.locator("section h2").first().textContent();
  await page.waitForTimeout(7000);
  const t4 = await page.locator("section h2").first().textContent();
  console.log("paused on hover:", t3 === t4);

  await browser.close();
});
