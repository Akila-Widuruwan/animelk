import { extractAbyssSlug, resolveAbyss } from "@/lib/abyss";

export const dynamic = "force-dynamic";

const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 5 * 60 * 1000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url") || url.searchParams.get("slug");
  const slug = extractAbyssSlug(target || "");

  if (!slug) {
    return Response.json({ ok: false, error: "Invalid abyss.to URL or slug" }, { status: 400 });
  }

  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL) {
    return Response.json({ ok: true, data: hit.data });
  }

  const data = await resolveAbyss(slug);
  if (!data) {
    return Response.json({ ok: false, error: "Failed to resolve video" }, { status: 502 });
  }

  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(slug, { at: Date.now(), data });

  return Response.json({ ok: true, data });
}
