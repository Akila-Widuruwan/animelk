import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const bad = [];
  p.on("response", (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 140)}`);
  });

  await p.goto("http://localhost:3000/anime/1/watch?ep=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(15000);
  console.log("failed requests:", bad.length ? bad : "none");
  await b.close();
});
