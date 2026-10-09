const ALLOWED_HOST =
  /^(archive\.org|(?:[a-z0-9-]+\.)*archive\.org|ia[a-z0-9-]+\.us\.archive\.org)$/i;

const ALLOWED_PATH = /(^|\/)(download|serve|items)\//i;

export function isArchiveUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return false;
    if (!ALLOWED_HOST.test(u.hostname)) return false;
    if (!ALLOWED_PATH.test(u.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isPcloudUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return false;
    return /(^|\.)pcloud\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

export function isProxyableUrl(value: string): boolean {
  return isArchiveUrl(value) || isPcloudUrl(value);
}

export function streamUrl(value: string): string {
  return isProxyableUrl(value)
    ? `/api/stream?url=${encodeURIComponent(value)}&v=2`
    : value;
}

export interface VideoSource {
  url: string;
  raw?: string;
  height?: number;
  multi?: boolean;
}

const HEIGHT_RE = /(\d{3,4})p/gi;

function extractHeight(url: string): number | undefined {
  const matches = [...url.matchAll(HEIGHT_RE)];
  const last = matches[matches.length - 1];
  return last ? Number(last[1]) : undefined;
}

export function parseVideoSources(value: string): VideoSource[] {
  const parts = value
    .split(/[|\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return [{ url: streamUrl(parts[0] ?? ""), raw: parts[0] ?? "" }];
  }
  return parts.map((url) => {
    const height = extractHeight(url);
    return height
      ? { url: streamUrl(url), raw: url, height }
      : { url: streamUrl(url), raw: url };
  });
}

const DEFAULT_SERVER_HEIGHTS = [1080, 720, 480];

export function isAbyssUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return /(^|\.)(abyssplayer\.com|abyss\.to)$/i.test(u.hostname);
  } catch {
    return false;
  }
}

export function serverSources(value: string): (VideoSource | null)[] {
  const parts = value
    .split(/[|\n]/)
    .map((p) => p.trim());
  while (parts.length < 3) parts.push("");
  return parts.slice(0, 3).map((url, i) => {
    if (!url) return null;
    const height = extractHeight(url);
    const multi = i === 0 && !height && isAbyssUrl(url);
    const resolvedHeight = height ?? (multi ? undefined : DEFAULT_SERVER_HEIGHTS[i]);
    return { url: streamUrl(url), raw: url, height: resolvedHeight, multi };
  });
}

const DIRECT_MEDIA_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v|mkv|m3u8)(\?|$)/i;

/**
 * HLS manifests that are not served from a `.m3u8` path — MegaPlay-style
 * players hand out `…/api/playlist.php?t=<token>` instead. The response is a
 * plain HLS playlist, so any HLS-capable player can open it.
 */
const HLS_ENDPOINT = /\/(playlist|master)\.php$/i;

export function isHlsEndpointUrl(value: string): boolean {
  try {
    return HLS_ENDPOINT.test(new URL(value).pathname);
  } catch {
    return false;
  }
}

export function isDirectMediaUrl(value: string): boolean {
  return DIRECT_MEDIA_EXT.test(value) || isPcloudUrl(value) || isHlsEndpointUrl(value);
}

/* ------------------------- source classification ------------------------- */

/** How an episode source has to be played. */
export type SourceKind = "hls" | "video" | "mkv" | "embed" | "unknown";

const MKV_EXT = /\.(mkv)(\?|#|$)/i;
const MEDIA_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov)(\?|#|$)/i;
const HLS_EXT = /\.(m3u8)(\?|#|$)/i;

/**
 * Classifies a source from its URL alone, without any network access.
 * Returns "unknown" when nothing about the URL says what it is, and the caller
 * should fall back to {@link probeSourceKind}.
 */
export function hintKind(value: string): SourceKind {
  const raw = (value || "").trim();
  if (!raw) return "unknown";
  if (MKV_EXT.test(raw)) return "mkv";
  if (HLS_EXT.test(raw)) return "hls";
  if (MEDIA_EXT.test(raw)) return "video";
  try {
    // The relative path needs a base; the host itself is never used.
    const u = new URL(raw, "https://relative.invalid");
    // Everything we proxy is media, never a page: classify what is inside so a
    // proxied .m3u8 still gets hls.js.
    if (u.pathname === "/api/stream") {
      const inner = u.searchParams.get("url");
      const innerKind = inner ? hintKind(inner) : "unknown";
      return innerKind === "unknown" ? "video" : innerKind;
    }
    // Abyss hands out a player page, not a stream.
    if (isAbyssUrl(raw)) return "embed";
    if (HLS_ENDPOINT.test(u.pathname)) return "hls";
  } catch {
    return "unknown";
  }
  return "unknown";
}

const PROBE_BYTES = 2048;
const PROBE_TIMEOUT = 8000;
const PROBE_TTL = 10 * 60 * 1000;

const probeCache = new Map<string, { at: number; kind: SourceKind }>();

/** Pulls at most PROBE_BYTES off a response without downloading the rest. */
async function peek(res: Response): Promise<Uint8Array> {
  const body = res.body;
  if (!body) {
    const all = new Uint8Array(await res.arrayBuffer());
    return all.subarray(0, PROBE_BYTES);
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < PROBE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        size += value.length;
      }
    }
  } catch {
    // a short read is still worth inspecting
  }
  try {
    await reader.cancel();
  } catch {
    // already closed
  }
  const out = new Uint8Array(Math.min(size, PROBE_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= out.length) break;
    const take = Math.min(chunk.length, out.length - offset);
    out.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  return out;
}

/** Container magic numbers, so a file served as octet-stream is still known. */
function sniff(bytes: Uint8Array): SourceKind | null {
  const at = (i: number, text: string) => {
    for (let j = 0; j < text.length; j++) {
      if (bytes[i + j] !== text.charCodeAt(j)) return false;
    }
    return true;
  };
  if (at(0, "#EXTM3U")) return "hls";
  if (at(4, "ftyp")) return "video";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "mkv";
  }
  if (at(0, "OggS") || at(0, "RIFF")) return "video";
  return null;
}

/**
 * Resolves an extension-less source by peeking at the first bytes of the
 * response, which is what tells an HLS playlist (`#EXTM3U`) apart from a video
 * file and from an embed page. A cross-origin page that refuses the request is
 * an embed, which is how third-party players keep working.
 */
export async function probeSourceKind(value: string): Promise<SourceKind> {
  const known = hintKind(value);
  if (known !== "unknown") return known;

  const raw = (value || "").trim();
  if (!raw) return "unknown";

  const cached = probeCache.get(raw);
  if (cached && Date.now() - cached.at < PROBE_TTL) return cached.kind;

  let kind: SourceKind = "embed";
  try {
    const res = await fetch(raw, {
      // A single range is a CORS-safelisted header, so this adds no preflight.
      headers: { Range: `bytes=0-${PROBE_BYTES - 1}` },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT),
    });
    if (res.ok || res.status === 206) {
      const type = (res.headers.get("content-type") || "").toLowerCase();
      const bytes = await peek(res);
      const head = new TextDecoder("utf-8", { fatal: false })
        .decode(bytes)
        .replace(/^\uFEFF/, "")
        .replace(/^\s+/, "");
      const magic = sniff(bytes);
      if (head.startsWith("#EXTM3U") || magic === "hls" || type.includes("mpegurl")) {
        kind = "hls";
      } else if (type.startsWith("video/") || type.startsWith("audio/")) {
        kind = "video";
      } else if (magic) {
        kind = magic;
      } else if (
        type.includes("matroska") ||
        type.includes("html") ||
        type.includes("xml") ||
        head.startsWith("<") ||
        head.startsWith("{") ||
        head.startsWith("[")
      ) {
        kind = "embed";
      } else {
        // Reached only when CORS allowed the read and the payload is neither a
        // page nor text: a media file behind a generic Content-Type.
        kind = "video";
      }
    }
  } catch {
    kind = "embed";
  }

  if (probeCache.size > 200) {
    const oldest = probeCache.keys().next().value;
    if (oldest) probeCache.delete(oldest);
  }
  probeCache.set(raw, { at: Date.now(), kind });
  return kind;
}
