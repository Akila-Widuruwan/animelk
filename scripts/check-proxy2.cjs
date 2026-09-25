import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const consoles = [];
  p.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      consoles.push(`[${m.type()}] ${m.text().slice(0, 200)}`);
  });

  await p.goto("http://localhost:3000/anime/1/watch?ep=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(12000);

  const body = await p.evaluate(() => {
    const doc = document.querySelector("iframe")?.contentDocument;
    if (!doc) return "no doc";
    return doc.body ? doc.body.innerText.slice(0, 300) : "no body";
  });
  console.log("iframe body text:", JSON.stringify(body));
  console.log("console messages:");
  consoles.slice(0, 15).forEach((c) => console.log(" ", c));

  await b.close();
});
