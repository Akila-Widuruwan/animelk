import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  m.on("console", (msg) => console.log("[console]", msg.text().slice(0, 150)));
  await m.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await m.waitForTimeout(2500);
  await m.locator('button[aria-label="Open menu"]').click();
  await m.waitForTimeout(600);
  const mInput = m.locator('input[aria-label="Search anime"]:visible');
  await mInput.click();
  await mInput.fill("bleach");
  await m.waitForTimeout(1500);

  const info = await m.evaluate(() => {
    const drawer = document.querySelector(".fixed.inset-0.z-50");
    return {
      drawerExists: !!drawer,
      drawerHtml: drawer ? drawer.innerHTML.slice(0, 400) : "no drawer",
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await b.close();
});
