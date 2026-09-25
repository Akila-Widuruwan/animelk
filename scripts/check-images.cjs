import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  const consoleErrs = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
  p.on("console", (m) => {
    if (m.type() === "error") consoleErrs.push(m.text().slice(0, 150));
  });

  for (const url of [
    "http://localhost:3000",
    "http://localhost:3000/anime/1",
    "http://localhost:3000/anime/1/watch",
    "http://localhost:3000/anime/21/watch?ep=1",
  ]) {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(2500);
    console.log("checked:", url);
  }

  console.log("page errors:", errors.length ? errors : "none");
  console.log("console errors:", consoleErrs.length ? consoleErrs : "none");
  await b.close();
});
