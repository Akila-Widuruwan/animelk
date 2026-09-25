import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const viewports = [
    [1920, 1080],
    [1600, 900],
    [1440, 900],
    [1366, 768],
    [1280, 720],
    [1024, 768],
    [768, 1024],
    [430, 932],
    [390, 844],
    [375, 812],
  ];

  for (const [w, h] of viewports) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    p.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
    await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(3500);

    const res = await p.evaluate(() => {
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      const hero = document.querySelector("section#hero h2");
      const titleSize = hero ? parseFloat(getComputedStyle(hero).fontSize) : 0;
      const nav = document.querySelector("header nav");
      const navVisible = nav ? getComputedStyle(nav).display !== "none" : false;
      return {
        overflow,
        titleSize: Math.round(titleSize),
        navVisible,
        cards: document.querySelectorAll("a[href^='/anime/']").length,
      };
    });

    console.log(
      `${w}x${h}: overflow=${res.overflow}px heroTitle=${res.titleSize}px nav=${res.navVisible} links=${res.cards} errors=${errors.length}`
    );
    if ([1920, 1440, 1366, 390].includes(w)) {
      await p.screenshot({ path: `C:\\Users\\AKILAW~1\\AppData\\Local\\Temp\\opencode\\home-${w}.png` });
    }
    await p.close();
  }
  await b.close();
});
