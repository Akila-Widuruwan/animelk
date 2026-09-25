import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

  await p.goto("http://localhost:3000/anime/1/watch?ep=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(10000);

  const info = await p.evaluate(() => {
    const iframe = document.querySelector("iframe");
    if (!iframe) return { iframe: false };
    const src = iframe.getAttribute("src") ?? "";
    let doc = null;
    let video = null;
    let videoSrc = "";
    let canAccess = false;
    try {
      doc = iframe.contentDocument;
      canAccess = !!doc;
      if (doc) {
        video = doc.querySelector("video");
        if (video) {
          videoSrc = video.currentSrc || video.src || "";
        }
      }
    } catch {
      canAccess = false;
    }
    return { iframe: true, src, canAccess, hasVideo: !!video, videoSrc, docTitle: doc?.title ?? "" };
  });

  console.log("iframe src:", info.src);
  console.log("same-origin access:", info.canAccess);
  console.log("video element found:", info.hasVideo);
  console.log("video src:", info.videoSrc.slice(0, 100));
  console.log("doc title:", info.docTitle.slice(0, 60));

  console.log("page errors:", errors.length ? errors : "none");
  await b.close();
});
