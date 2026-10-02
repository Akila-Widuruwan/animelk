import { NextRequest } from "next/server";
import { isArchiveUrl, isPcloudUrl } from "@/lib/stream";

export const dynamic = "force-dynamic";

const READAHEAD = 8 * 1024 * 1024;
const CACHE_MAX_BYTES = 96 * 1024 * 1024;

interface Chunk {
  start: number;
  end: number;
  buf: Buffer;
}

const chunkCache = new Map<string, Chunk[]>();
const totalCache = new Map<string, { at: number; total: number }>();
const TOTAL_TTL = 60 * 60 * 1000;

async function resolveTotal(target: string, fallback: number): Promise<number> {
  const hit = totalCache.get(target);
  if (hit && Date.now() - hit.at < TOTAL_TTL) return hit.total;
  try {
    const probe = await fetch(target, {
      headers: { Range: "bytes=0-0" },
      redirect: "follow",
    });
    const cr = probe.headers.get("content-range");
    if (probe.status === 206 && cr) {
      const total = Number(cr.split("/")[1]) - 1;
      if (Number.isFinite(total) && total >= 0) {
        totalCache.set(target, { at: Date.now(), total });
        return total;
      }
    }
  } catch {
    // fall back to the requested end
  }
  return fallback;
}

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".mp3": "audio/mpeg",
  ".vtt": "text/vtt",
  ".srt": "application/x-subrip",
};

function mimeFor(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    for (const [ext, mime] of Object.entries(MIME_BY_EXT)) {
      if (path.endsWith(ext)) return mime;
    }
  } catch {
    // ignore
  }
  return "application/octet-stream";
}

function cacheBytes(): number {
  let n = 0;
  for (const chunks of chunkCache.values()) {
    for (const c of chunks) n += c.buf.length;
  }
  return n;
}

function evictIfNeeded() {
  while (cacheBytes() > CACHE_MAX_BYTES) {
    const firstKey = chunkCache.keys().next().value;
    if (!firstKey) return;
    const arr = chunkCache.get(firstKey)!;
    arr.shift();
    if (!arr.length) chunkCache.delete(firstKey);
  }
}

function parseRange(header: string | null): { start: number; end: number | null } | null {
  if (!header) return null;
  const m = header.match(/^bytes=(\d+)-(\d*)$/i);
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : null;
  return { start, end };
}

async function fetchRange(url: string, start: number, end: number): Promise<Buffer> {
  const r = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
    redirect: "follow",
  });
  if (r.status !== 206) throw new Error("upstream range unsupported");
  return Buffer.from(await r.arrayBuffer());
}

function findChunk(chunks: Chunk[], start: number, end: number): Chunk | null {
  return chunks.find((c) => c.start <= start && c.end >= end) ?? null;
}

async function getBytes(
  url: string,
  start: number,
  end: number,
  total: number
): Promise<Buffer> {
  let arr = chunkCache.get(url);
  if (!arr) {
    arr = [];
    chunkCache.set(url, arr);
  }
  const hit = findChunk(arr, start, end);
  if (hit) return hit.buf.subarray(start - hit.start, end - hit.start + 1);

  const buf = await fetchRange(url, start, end);
  arr.push({ start, end, buf });
  evictIfNeeded();

  const nextStart = end + 1;
  const nextEnd = Math.min(end + READAHEAD, Math.max(total - 1, nextStart));
  if (nextEnd > nextStart && !findChunk(arr, nextStart, nextEnd)) {
    void (async () => {
      try {
        const b = await fetchRange(url, nextStart, nextEnd);
        const current = chunkCache.get(url);
        if (current) {
          current.push({ start: nextStart, end: nextEnd, buf: b });
          evictIfNeeded();
        }
      } catch {
        // read-ahead is best-effort
      }
    })();
  }
  return buf;
}

function resolveTarget(request: NextRequest): string | null {
  const target = request.nextUrl.searchParams.get("url");
  if (!target || (!isArchiveUrl(target) && !isPcloudUrl(target))) return null;
  return target;
}

export async function HEAD(request: NextRequest) {
  const target = resolveTarget(request);
  if (!target) return new Response("Invalid or disallowed URL", { status: 400 });

  const upstream = await fetch(target, {
    method: "GET",
    headers: { Range: "bytes=0-0" },
    redirect: "follow",
  });

  if (upstream.status !== 206) {
    return new Response("Upstream fetch failed", { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", mimeFor(target));
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "no-store");
  const contentLength = upstream.headers.get("content-range")?.split("/")[1];
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(null, { status: 200, headers });
}

export async function GET(request: NextRequest) {
  const target = resolveTarget(request);
  if (!target) return new Response("Invalid or disallowed URL", { status: 400 });

  const range = parseRange(request.headers.get("range"));
  const mime = mimeFor(target);

  if (range && range.end !== null) {
    const total = await resolveTotal(target, range.end);
    const end = Math.min(range.end, total);
    try {
      const buf = await getBytes(target, range.start, end, total);
      const headers = new Headers();
      headers.set("Content-Type", mime);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Cache-Control", "no-store");
      headers.set("Content-Range", `bytes ${range.start}-${end}/${total + 1}`);
      headers.set("Content-Length", String(buf.length));
      return new Response(new Uint8Array(buf), { status: 206, headers });
    } catch {
      // fall through to plain streaming
    }
  }

  const upstream = await fetch(target, {
    headers: range ? { Range: request.headers.get("range")! } : {},
    redirect: "follow",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Upstream fetch failed", {
      status: upstream.status === 404 ? 404 : 502,
    });
  }

  const headers = new Headers();
  headers.set("Content-Type", mime);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "no-store");
  if (upstream.status === 206) {
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
