import { createClient } from "@supabase/supabase-js";
import { isAdminRequest } from "@/lib/admin-auth";
import { checkUrl } from "@/lib/checkUrls";

export const dynamic = "force-dynamic";

const CONCURRENCY = 6;

interface EpisodeRow {
  anime_id: number;
  episode_number: number;
  video_url: string | null;
}

interface AnimeRow {
  id: number;
  title: string;
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ ok: false, error: "Admin login required" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return Response.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(url, anon);
  const { data: episodes } = await sb
    .from("episodes")
    .select("anime_id, episode_number, video_url")
    .limit(1000);
  const rows = (episodes as EpisodeRow[] | null) ?? [];

  const animeIds = [...new Set(rows.map((e) => e.anime_id))];
  const titleById = new Map<number, string>();
  for (let i = 0; i < animeIds.length; i += 100) {
    const chunk = animeIds.slice(i, i + 100);
    const { data } = await sb
      .from("anime")
      .select("id, title")
      .in("id", chunk);
    for (const a of (data as AnimeRow[] | null) ?? []) {
      titleById.set(a.id, a.title);
    }
  }

  const targets = rows.flatMap((e) =>
    (e.video_url ?? "")
      .split(/[|\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((videoUrl, i) => ({
        animeId: e.anime_id,
        animeTitle: titleById.get(e.anime_id) ?? `Anime #${e.anime_id}`,
        episode: e.episode_number,
        server: i + 1,
        url: videoUrl,
      }))
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          // client disconnected
        }
      };

      send({ type: "total", total: targets.length });

      const queue = [...targets];
      let checked = 0;

      const worker = async () => {
        while (queue.length > 0 && !request.signal.aborted) {
          const target = queue.shift();
          if (!target) break;
          const outcome = await checkUrl(target.url);
          checked += 1;
          send({ type: "result", result: { ...target, ...outcome } });
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, Math.max(targets.length, 1)) }, worker)
      );

      send({ type: "done", total: targets.length, checked });
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
    cancel() {
      // client aborted — nothing to clean up
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
