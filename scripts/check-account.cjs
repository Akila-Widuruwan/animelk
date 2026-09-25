import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 90000 });

  await p.locator('button[aria-label="Account"]').click();
  await p.waitForTimeout(300);
  const visible = await p.locator("text=Welcome to ANIMELK").isVisible();
  console.log("dropdown visible after click:", visible);

  await p.mouse.click(600, 400);
  await p.waitForTimeout(300);
  const closedOutside = !(await p.locator("text=Welcome to ANIMELK").isVisible());
  console.log("closes on outside click:", closedOutside);
  console.log("page errors:", errors.length ? errors : "none");
  await b.close();
});
