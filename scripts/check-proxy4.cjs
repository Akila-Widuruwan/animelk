import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const consoles = [];
  p.on("console", (m) => {
    if (m.type() === "error") consoles.push(m.text().slice(0, 250));
  });

  await p.goto("http://localhost:3000/anime/1/watch?ep=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(20000);

  const state = await p.evaluate(() => {
    const doc = document.querySelector("iframe")?.contentDocument;
    if (!doc) return "no doc";
    const video = doc.querySelector("video");
    let jwState = "no jwplayer";
    let config = "";
    try {
      const w = doc.defaultView;
      if (typeof w.jwplayer === "function") {
        const pl = w.jwplayer();
        jwState = pl.getState ? pl.getState() : "no getState";
        config = JSON.stringify(pl.getConfig ? pl.getConfig() : {}).slice(0, 400);
      }
    } catch (e) {
      jwState = "err " + String(e);
    }
    return {
      hasVideo: !!video,
      videoSrc: video ? (video.currentSrc || video.src || "").slice(0, 150) : "",
      videoReady: video ? video.readyState : -1,
      jwState,
      config,
      bodyText: doc.body.innerText.slice(0, 200),
    };
  });
  console.log(JSON.stringify(state, null, 2));
  console.log("console errors:", consoles.slice(0, 8));
  await b.close();
});
