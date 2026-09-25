import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  const consoleErrs = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => {
    if (m.type() === "error") consoleErrs.push(m.text());
  });

  await p.goto("http://localhost:3000/admin", { waitUntil: "networkidle", timeout: 90000 });
  console.log("admin URL:", p.url());
  console.log("setup notice visible:", await p.locator("text=Supabase is not configured yet").isVisible());
  console.log("steps listed:", await p.locator("ol li").count());

  await p.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 90000 });
  const footerAdmin = await p.locator('a[href="/admin"]').count();
  console.log("footer admin link:", footerAdmin > 0);

  console.log("page errors:", errors.length ? errors : "none");
  console.log("console errors:", consoleErrs.length ? consoleErrs : "none");
  await b.close();
});
