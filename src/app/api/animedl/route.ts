import { animedlDownloadLinks, searchAnimedl } from "@/lib/animedl";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const linksAnilist = url.searchParams.get("links");
  const ep = url.searchParams.get("ep");

  if (linksAnilist) {
    const data = await animedlDownloadLinks(Number(linksAnilist), Number(ep) || 1);
    if (!data) {
      return Response.json({ ok: false, error: "No links found on AnimeDL" }, { status: 404 });
    }
    return Response.json({ ok: true, data });
  }

  const results = await searchAnimedl(q || "", q ? 8 : 3);
  return Response.json({ ok: true, results });
}
