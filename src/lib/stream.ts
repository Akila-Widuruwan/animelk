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

export function isDirectMediaUrl(value: string): boolean {
  return DIRECT_MEDIA_EXT.test(value) || isPcloudUrl(value);
}
