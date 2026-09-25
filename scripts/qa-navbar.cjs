import("playwright").then(async ({ chromium }) => {
  const { PNG } = await import("pngjs");

  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(3000);

  const NAV_H = 72;
  const bandMax = (buf, png, y0, y1) => {
    let max = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < png.width; x++) {
        const i = (y * png.width + x) * 4;
        const v = Math.max(buf[i], buf[i + 1], buf[i + 2]);
        if (v > max) max = v;
      }
    }
    return max;
  };

  let worst = 0;
  for (const y of [0, 40, 150, 400, 800, 1200]) {
    await p.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y);
    // capture mid-transition
    await p.waitForTimeout(80);
    let shot = await p.screenshot();
    let png = PNG.sync.read(shot);
    const mid = bandMax(png.data, png, NAV_H + 2, NAV_H + 10) -
      bandMax(png.data, png, NAV_H + 14, NAV_H + 30);
    // capture settled
    await p.waitForTimeout(600);
    shot = await p.screenshot();
    png = PNG.sync.read(shot);
    const settled = bandMax(png.data, png, NAV_H + 2, NAV_H + 10) -
      bandMax(png.data, png, NAV_H + 14, NAV_H + 30);
    worst = Math.max(worst, mid, settled);
    console.log(`scrollY=${y}: seam delta mid=${mid} settled=${settled}`);
  }

  const styles = await p.evaluate(() => {
    const h = document.querySelector("header");
    const cs = getComputedStyle(h);
    return {
      borderBottom: cs.borderBottomWidth,
      backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter || "none",
      position: cs.position,
      height: cs.height,
    };
  });
  console.log("header:", JSON.stringify(styles));

  console.log("worst seam brightness delta:", worst, worst < 40 ? "(no white line)" : "(WHITE LINE PRESENT)");
  await b.close();
});
