import("playwright").then(async ({ chromium }) => {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 90000 });

  const overflow = await page.evaluate(() => {
    const header = document.querySelector("header");
    const inner = header.firstElementChild;
    const r = inner.getBoundingClientRect();
    return {
      headerScrollWidth: header.scrollWidth,
      viewport: window.innerWidth,
      innerRight: r.right,
      items: [...document.querySelectorAll("header nav a")].map((a) => a.textContent.trim()),
    };
  });
  console.log("viewport:", overflow.viewport);
  console.log("nav items:", JSON.stringify(overflow.items));
  console.log("header overflow:", overflow.headerScrollWidth > overflow.viewport ? "YES (broken)" : "no");
  console.log("inner container within viewport:", overflow.innerRight <= overflow.viewport ? "yes" : "NO");

  const menuVisible = await page.locator("header nav a", { hasText: "Home" }).isVisible();
  console.log("desktop menu visible at 1366px:", menuVisible);

  await page.locator("header nav a", { hasText: "Genres" }).click();
  await page.waitForTimeout(1200);
  const scrolled = await page.evaluate(() => window.scrollY);
  console.log("clicked Genres -> scrollY:", Math.round(scrolled), scrolled > 100 ? "(works)" : "(did NOT scroll)");

  const nearCategories = await page.evaluate(() => {
    const el = document.getElementById("categories");
    const r = el.getBoundingClientRect();
    return Math.abs(r.top) < 200;
  });
  console.log("landed near categories section:", nearCategories);

  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(500);
  const sticky = await page.evaluate(() => {
    const h = document.querySelector("header");
    const s = getComputedStyle(h);
    return { position: s.position, top: h.getBoundingClientRect().top };
  });
  console.log("after scroll header position:", sticky.position, "top:", Math.round(sticky.top));

  console.log("page errors:", errors.length ? errors : "none");
  await browser.close();
});
