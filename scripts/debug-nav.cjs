import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  p.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
  p.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 200));
  });

  await p.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 90000 });
  console.log("home:", p.url());

  const links = p.locator("a[href^='/anime/']");
  console.log("anime links on home:", await links.count());
  const first = links.first();
  console.log("first link href:", await first.getAttribute("href"));
  console.log("first link visible:", await first.isVisible());
  const box = await first.boundingBox();
  console.log("first link box:", box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` : "null");

  try {
    await first.click({ timeout: 5000 });
  } catch (e) {
    console.log("CLICK ERROR:", String(e).split("\n")[0]);
  }
  await p.waitForTimeout(1500);
  console.log("after click url:", p.url());

  await b.close();
});
