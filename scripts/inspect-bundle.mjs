const core = await fetch("https://iamcdn.net/player-v2/core.bundle.js").then((r) => r.text());
const lite = await fetch("https://iamcdn.net/player-v2/lite.bundle.js").then((r) => r.text());

console.log("core: fetch", (core.match(/fetch\(/g) || []).length,
  "| xhr", (core.match(/XMLHttpRequest/g) || []).length,
  "| m3u8", (core.match(/m3u8/g) || []).length,
  "| SoTrym", (core.match(/SoTrym/g) || []).length);
console.log("lite: fetch", (lite.match(/fetch\(/g) || []).length,
  "| m3u8", (lite.match(/m3u8/g) || []).length);

const i = core.indexOf("SoTrym");
if (i >= 0) console.log("--- SoTrym context ---\n" + core.slice(Math.max(0, i - 300), i + 600));
