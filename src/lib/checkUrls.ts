export type CheckStatus = "alive" | "dead" | "error";

export interface CheckOutcome {
  status: CheckStatus;
  httpStatus?: number;
  note?: string;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function normalizeUrl(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function isAbyssUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return /(^|\.)(abyssplayer\.com|abyss\.to)$/i.test(u.hostname);
  } catch {
    return false;
  }
}

async function checkAbyss(url: string): Promise<CheckOutcome> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { status: "dead", httpStatus: res.status, note: "Abyss page unavailable" };
    }
    const html = await res.text();
    if (html.includes("core.bundle.js") || html.includes("jwplayer")) {
      return { status: "alive", httpStatus: res.status };
    }
    return { status: "dead", httpStatus: res.status, note: "Video removed from Abyss" };
  } catch {
    return { status: "error", note: "Network error" };
  }
}

async function checkDirect(url: string): Promise<CheckOutcome> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0", "user-agent": UA },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    await res.arrayBuffer().catch(() => null);
    if (res.status >= 200 && res.status < 300) {
      return { status: "alive", httpStatus: res.status };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        status: "dead",
        httpStatus: res.status,
        note: "Forbidden (likely taken down)",
      };
    }
    if (res.status === 404 || res.status === 410) {
      return { status: "dead", httpStatus: res.status, note: "Not found" };
    }
    if (res.status >= 500) {
      return { status: "dead", httpStatus: res.status, note: "Server error" };
    }
    return { status: "error", httpStatus: res.status, note: `Unexpected status ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return { status: "error", note: msg.includes("timeout") ? "Timed out" : "Network error" };
  }
}

export async function checkUrl(rawUrl: string): Promise<CheckOutcome> {
  const url = normalizeUrl(rawUrl);
  if (!url) return { status: "error", note: "Empty URL" };
  try {
    new URL(url);
  } catch {
    return { status: "error", note: "Invalid URL" };
  }
  if (isAbyssUrl(url)) return checkAbyss(url);
  return checkDirect(url);
}
