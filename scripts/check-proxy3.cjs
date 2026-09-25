import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const bad = [];
  p.on("response", (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });

  await p.goto("http://localhost:3000/anime/1/watch?ep=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(12000);

  console.log("failed requests:");
  bad.forEach((x) => console.log(" ", x));

  const state = await p.evaluate(() => {
    const doc = document.querySelector("iframe")?.contentDocument;
    if (!doc) return "no doc";
    const scripts = Array.from(doc.querySelectorAll("script")).map((s) => s.src);
    return { soTrym: typeof doc.defaultView.SoTrym, jw: typeof doc.defaultView.jwplayer, scripts };
  });
  console.log("SoTrym:", state.soTrym, "| jwplayer:", state.jw);
  console.log("scripts in iframe doc:", state.scripts);

  await b.close();
});
