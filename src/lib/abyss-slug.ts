/** Client-safe abyss slug parsing (no node-only imports). */

const ABYSS_HOST = /(^|\.)(abyssplayer\.com|abyss\.to)$/i;
/** abyss file ids are short alphanumeric slugs. */
const SLUG_RE = /^[A-Za-z0-9_-]{7,17}$/;

/**
 * Extracts the file id from a single abyss player/embed URL or a bare id.
 * Returns null for anything that is not an abyss asset.
 */
function slugFromOne(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  // Bare id (no scheme) — accept only a plausible abyss file id.
  if (!/^https?:\/\//i.test(raw)) return SLUG_RE.test(raw) ? raw : null;

  try {
    const u = new URL(raw);
    if (!ABYSS_HOST.test(u.hostname)) return null;
    const segments = u.pathname.split("/").filter(Boolean);
    // player.abyssplayer.com/<id>
    if (segments[0] && SLUG_RE.test(segments[0])) return segments[0];
    // /v/<id>, /embed/<id>, /e/<id>
    const last = segments[segments.length - 1];
    if (last && SLUG_RE.test(last)) return last;
  } catch {
    return null;
  }
  return null;
}

/**
 * Extracts the abyss.to video id (the same id used by the subtitle API) from:
 *   - an abyss player/embed URL:  https://player.abyssplayer.com/Y3rXZpZoP
 *   - a bare id:                 Y3rXZpZoP
 *   - a multi-server value:      <1080p>|<720p>|<480p>  (abyss link wins)
 *
 * Returns null when the value contains no abyss id. The abyss video id and the
 * subtitle file id are the same value.
 */
export function extractAbyssSlug(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  const parts = raw.includes("|") || raw.includes("\n") ? raw.split(/[|\n]/) : [raw];
  for (const part of parts) {
    const slug = slugFromOne(part);
    if (slug) return slug;
  }
  return null;
}

/** True when the value points at an abyss.to / abyssplayer.com asset. */
export function isAbyssUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return ABYSS_HOST.test(u.hostname);
  } catch {
    return false;
  }
}
