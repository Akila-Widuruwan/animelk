import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  const reqs = [];
  m.on("request", (r) => {
    if (r.url().includes("/api/search")) reqs.push(r.url());
  });
  m.on("response", async (r) => {
    if (r.url().includes("/api/search")) {
      console.log("API response:", r.status(), (await r.text()).slice(0, 200));
    }
  });

  await m.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await m.waitForTimeout(2500);
  await m.locator('button[aria-label="Open menu"]').click();
  await m.waitForTimeout(600);
  const mInput = m.locator('input[aria-label="Search anime"]:visible');
  await mInput.fill("bleach");
  await m.waitForTimeout(2000);

  console.log("api requests fired:", reqs);
  const dd = await m.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a[href^='/anime/']"))
      .map((a) => a.textContent.trim().slice(0, 40))
      .filter((t) => t.length);
    return links;
  });
  console.log("visible anime links in DOM:", dd);
  await b.close();
});
