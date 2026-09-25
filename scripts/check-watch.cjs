import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto("http://localhost:3000/anime/1/watch", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(3000);
  const info = await p.evaluate(() => {
    const iframes = [...document.querySelectorAll("iframe")];
    const videos = [...document.querySelectorAll("video")];
    const demoBtn = document.querySelector('button[aria-label="Play"]');
    return {
      iframes: iframes.map((f) => ({ src: (f.getAttribute("src") || "").slice(0, 60), box: f.getBoundingClientRect().width + "x" + f.getBoundingClientRect().height })),
      videos: videos.length,
      demoPlayButton: !!demoBtn,
      bodySnippet: document.body.innerText.slice(0, 200),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await b.close();
});
