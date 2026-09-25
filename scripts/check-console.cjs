import("playwright").then(async ({ chromium }) => {
  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 90000 });

  console.log("=== CONSOLE ERRORS/WARNINGS ===");
  consoleErrors.forEach((e) => console.log(e));
  console.log("=== PAGE ERRORS ===");
  pageErrors.forEach((e) => console.log(e));
  if (!consoleErrors.length && !pageErrors.length) console.log("(none)");

  await browser.close();
});
