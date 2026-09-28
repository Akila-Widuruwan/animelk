import { createHash } from "node:crypto";

const PLAYER_HOST = "player.abyssplayer.com";

export interface AbyssSubtitleInfo {
  lang: string | null;
  slug: string | null;
  type: string | null;
}

export interface AbyssSource {
  label: string;
  res_id: number;
  size: number;
  codec: string | null;
  status: boolean;
  sub: string | null;
  path?: string | null;
  url?: string | null;
  partSize?: number | null;
}

export interface AbyssResolution {
  slug: string;
  title: string | null;
  poster: string | null;
  subtitles: AbyssSubtitleInfo[];
  sources: AbyssSource[];
  domains: string[];
}

export function extractAbyssSlug(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return raw;
  try {
    const u = new URL(raw);
    const m = u.pathname.match(/\/(?:v|embed|e)?\/?([A-Za-z0-9_-]{7,17})\/?$/);
    if (m) return m[1];
    if (u.hostname === PLAYER_HOST) {
      const seg = u.pathname.split("/").filter(Boolean)[0];
      if (seg) return seg;
    }
  } catch {
    return null;
  }
  return null;
}

async function aesCtrDecrypt(
  data: Uint8Array,
  keyString: string
): Promise<string> {
  const md5hex = createHash("md5").update(keyString).digest("hex");
  const keyBytes = new TextEncoder().encode(md5hex);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "AES-CTR", length: 128 },
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-CTR", counter: keyBytes.slice(0, 16) as unknown as BufferSource, length: 64 },
    key,
    data as unknown as BufferSource
  );
  return new TextDecoder().decode(decrypted);
}

interface AbyssDatas {
  slug: string;
  md5_id: number;
  user_id: number;
  media: string;
  config?: {
    poster?: boolean;
    preview?: boolean;
    subtitles?: AbyssSubtitleInfo[];
  };
}

export async function resolveAbyss(slug: string): Promise<AbyssResolution | null> {
  const res = await fetch(`https://${PLAYER_HOST}/${slug}`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const html = await res.text();
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);

  const datasMatch = html.match(/const datas = "([^"]+)"/);
  if (!datasMatch) {
    return {
      slug,
      title: titleMatch ? decodeHtml(titleMatch[1]) : null,
      poster: null,
      subtitles: [],
      sources: [],
      domains: [],
    };
  }

  const datas = JSON.parse(
    Buffer.from(datasMatch[1], "base64").toString("binary")
  ) as AbyssDatas;

  const poster = html.match(
    /freeimagecdn\.net\/image\/([A-Za-z0-9_-]+)(?:\/0)?\.jpg/
  );

  let media: {
    mp4?: { sources?: AbyssSource[]; domains?: string[] };
    [k: string]: unknown;
  } | null = null;
  try {
    if (typeof datas.media === "string" && datas.media) {
      const keyString = `${datas.user_id}:${datas.slug}:${datas.md5_id}`;
      const bytes = new Uint8Array(Buffer.from(datas.media, "binary"));
      const plain = await aesCtrDecrypt(bytes, keyString);
      media = JSON.parse(plain);
    }
  } catch {
    media = null;
  }

  return {
    slug: datas.slug || slug,
    title: titleMatch ? decodeHtml(titleMatch[1]) : null,
    poster: poster
      ? `https://img.freeimagecdn.net/image/${poster[1]}.jpg`
      : null,
    subtitles: datas.config?.subtitles ?? [],
    sources: media?.mp4?.sources ?? [],
    domains: media?.mp4?.domains ?? [],
  };
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function fetchAbyssSubtitleVtt(
  md5Id: number,
  subtitleSlug: string
): Promise<string | null> {
  const res = await fetch(
    `https://cdn.iamcdn.net/subtitle/${md5Id}/${subtitleSlug}.srt`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const srt = await res.text();
  return srtToVtt(srt);
}

function srtToVtt(srt: string): string {
  const lines = srt.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = ["WEBVTT", ""];
  for (const line of lines) {
    if (/^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(line)) {
      out.push(line.replace(/,/g, "."));
    } else if (/^\d+$/.test(line.trim())) {
      continue;
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}
