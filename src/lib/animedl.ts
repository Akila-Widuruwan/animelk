export interface AnimedlEntry {
  anilistId: number;
  title: string;
  banner: string;
  cover: string;
  episode: number;
}

const ENTRY_RE = /<article\b[^>]*\bclass="box row"[\s\S]*?<\/article>/g;

function parseAttr(html: string, name: string): string | null {
  const m = html.match(new RegExp(`data-${name}="([^"]*)"`));
  return m ? m[1] : null;
}

export function parseAnimedlPage(html: string): AnimedlEntry[] {
  const entries: AnimedlEntry[] = [];
  for (const block of html.matchAll(ENTRY_RE)) {
    const title = parseAttr(block[0], "title");
    const anilist = parseAttr(block[0], "anilist");
    const banner = parseAttr(block[0], "banner");
    const episode = parseAttr(block[0], "episode");
    const coverMatch = block[0].match(/<span class="thumb poster">[\s\S]*?<img src="([^"]*)"/);
    const cover = coverMatch ? coverMatch[1] : null;
    if (!title || !anilist || !cover) continue;
    entries.push({
      anilistId: Number(anilist),
      title,
      banner: banner || "",
      cover,
      episode: Number(episode) || 1,
    });
  }
  return entries;
}

export interface AnimedlAnime {
  anilistId: number;
  title: string;
  banner: string;
  cover: string;
}

export async function searchAnimedl(
  query: string,
  maxPages = 6
): Promise<AnimedlAnime[]> {
  const q = query.trim().toLowerCase();
  const seen = new Map<number, AnimedlAnime>();

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(`https://animedl.to/?page=${page}`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });
    if (!res.ok) break;
    const html = await res.text();
    const entries = parseAnimedlPage(html);
    if (entries.length === 0) break;

    for (const e of entries) {
      const existing = seen.get(e.anilistId);
      if (existing) {
        if (!existing.banner && e.banner) existing.banner = e.banner;
        continue;
      }
      const item: AnimedlAnime = {
        anilistId: e.anilistId,
        title: e.title,
        banner: e.banner,
        cover: e.cover,
      };
      if (q && !item.title.toLowerCase().includes(q)) continue;
      seen.set(e.anilistId, item);
    }

    if (q && seen.size >= 20) break;
  }

  return [...seen.values()];
}

export async function animedlDownloadLinks(
  anilistId: number,
  episode: number
): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `https://animedl.to/api/anilist/${anilistId}/${episode}/${Date.now()}`,
    {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
