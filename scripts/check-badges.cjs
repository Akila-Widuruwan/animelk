import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });

  // DB: ONE PIECE = 4K + SUB, Spirited Away = SUB + DUB, Naruto = HD + DUB
  const check = async (id, expected) => {
    await p.goto(`http://localhost:3000/anime/${id}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await p.waitForTimeout(1500);
    const texts = await p.evaluate(() => {
      const meta = document.querySelector("main");
      const spans = Array.from(
        meta.querySelectorAll(
          "span.rounded.px-1\\.5, span.rounded.px-1"
        )
      ).map((s) => s.textContent.trim());
      return spans.filter((t) => ["HD", "FHD", "4K", "SUB", "DUB"].includes(t));
    });
    const ok = expected.every((e) => texts.includes(e));
    console.log(
      `/anime/${id} expected ${expected.join("+")} -> badges on page: [${texts.join(", ")}] ${ok ? "MATCH" : "MISMATCH"}`
    );
  };

  await check(21, ["4K", "SUB"]);
  await check(199, ["SUB", "DUB"]);
  await check(20, ["HD", "DUB"]);

  await b.close();
});
