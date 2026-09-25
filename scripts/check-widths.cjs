import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  for (const w of [1280, 1440, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: 800 } });
    await p.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 90000 });
    const o = await p.evaluate(() => {
      const h = document.querySelector("header");
      const r = h.firstElementChild.getBoundingClientRect();
      const burger = document.querySelector('header button[aria-label="Open menu"]');
      return {
        overflow: h.scrollWidth > window.innerWidth,
        right: Math.round(r.right),
        burgerVisible: !!burger && getComputedStyle(burger).display !== "none",
      };
    });
    console.log(w + "px -> overflow:" + o.overflow + " innerRight:" + o.right + " burgerVisible:" + o.burgerVisible);
    await p.close();
  }
  await b.close();
});
