/**
 * Verifies the self-hosted media proxy rules in src/lib/stream.ts.
 *
 * A self-hosted file server is usually plain http://, which browsers refuse to
 * load from the https:// site (mixed content), so those links must be rewritten
 * to the same-origin /api/stream proxy — and nothing else may be, or the route
 * turns into an open proxy.
 *
 * Run: node scripts/check-selfhost-proxy.cjs
 */
const failures = [];
let checks = 0;

function ok(label, condition) {
  checks += 1;
  if (!condition) failures.push(label);
}

async function main() {
  const stream = await import("../src/lib/stream.ts");

  const selfHostHttp =
    "http://anilanka.akizzzvpn.ggff.net:7658/file/1792267614462_there-is-also-e3-720p.mp4";
  const selfHostHttps =
    "https://anilanka.akizzzvpn.ggff.net:7658/file/1792266135295_black-clover-s02e03.mp4";

  // The two links that were reported broken must be proxied, http or https,
  // and on any port.
  ok("http self-host link is proxied", stream.streamUrl(selfHostHttp).startsWith("/api/stream?url="));
  ok("https self-host link is proxied", stream.streamUrl(selfHostHttps).startsWith("/api/stream?url="));
  ok(
    "proxied url keeps the original link",
    stream.streamUrl(selfHostHttp) ===
      `/api/stream?url=${encodeURIComponent(selfHostHttp)}&v=2`
  );
  ok("isSelfHostedUrl accepts http", stream.isSelfHostedUrl(selfHostHttp));
  ok("isSelfHostedUrl accepts https", stream.isSelfHostedUrl(selfHostHttps));
  ok("isProxyableUrl accepts self-host", stream.isProxyableUrl(selfHostHttp));

  // The player must still recognise the proxied link as a direct video.
  ok("raw .mp4 classifies as video", stream.hintKind(selfHostHttp) === "video");
  ok("proxied .mp4 classifies as video", stream.hintKind(stream.streamUrl(selfHostHttp)) === "video");
  ok("server slot keeps the raw link", stream.serverSources(selfHostHttp)[0].raw === selfHostHttp);

  // Anything outside the allowlist must pass through untouched.
  const strangers = [
    "http://evil.com/file/video.mp4",
    "http://anilanka.akizzzvpn.ggff.net.evil.com/file/video.mp4",
    "http://fake.akizzzvpn.ggff.net/file/video.mp4",
    "https://example.com/video.mp4",
  ];
  for (const url of strangers) {
    ok(`not proxied: ${url}`, stream.streamUrl(url) === url);
    ok(`not proxyable: ${url}`, !stream.isProxyableUrl(url));
  }

  // The existing archive.org / pCloud behaviour is unchanged.
  ok(
    "pcloud still proxied",
    stream.streamUrl("https://filedn.com/a.720p.mp4") === "https://filedn.com/a.720p.mp4"
  );
  const archive = "https://archive.org/download/item/file.mp4";
  ok("archive.org still proxied", stream.streamUrl(archive).startsWith("/api/stream?url="));

  // Extra hosts come from NEXT_PUBLIC_PROXY_MEDIA_HOSTS, wildcards included.
  process.env.NEXT_PUBLIC_PROXY_MEDIA_HOSTS = "media.example.com,*.host.me";
  ok(
    "env host is proxied",
    stream.isSelfHostedUrl("http://media.example.com:9000/file/a.mp4")
  );
  ok(
    "env wildcard subdomain is proxied",
    stream.isSelfHostedUrl("http://a.host.me/file/b.mkv")
  );
  ok(
    "env wildcard root domain is NOT proxied",
    !stream.isSelfHostedUrl("http://host.me/file/b.mkv")
  );
  ok(
    "unrelated host still not proxied",
    !stream.isSelfHostedUrl("http://other.example.com/file/a.mp4")
  );
  delete process.env.NEXT_PUBLIC_PROXY_MEDIA_HOSTS;

  // The default host keeps working after the env var is removed.
  ok("default host still proxied", stream.isSelfHostedUrl(selfHostHttp));

  console.log(`${checks - failures.length}/${checks} checks passed`);
  if (failures.length) {
    console.error("FAILED:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
