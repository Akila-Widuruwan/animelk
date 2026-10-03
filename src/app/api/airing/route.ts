import { createClient } from "@supabase/supabase-js";
import { isAdminRequest } from "@/lib/admin-auth";
import { fetchAnilist, searchAnilist, type AnilistMedia } from "@/lib/anilist";

export const dynamic = "force-dynamic";

function adminClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  return createClient(url, anon, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
}

interface AnimeRow {
  id: number;
  title: string;
  anilist_id: number | null;
  status: string;
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ ok: false, error: "Admin login required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "search") {
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2) {
      return Response.json({ ok: false, error: "Enter at least 2 characters" }, { status: 400 });
    }
    try {
      const data = await searchAnilist(q);
      return Response.json({ ok: true, data });
    } catch (e) {
      return Response.json({ ok: false, error: e instanceof Error ? e.message : "Search failed" }, { status: 502 });
    }
  }

  if (action === "sync") {
    const sb = adminClient(request);
    if (!sb) {
      return Response.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
    }

    const { data } = await sb
      .from("anime")
      .select("id, title, anilist_id, status")
      .or("status.eq.RELEASING,status.eq.NOT_YET_RELEASED")
      .eq("completed", false)
      .limit(200);
    const rows = (data as AnimeRow[] | null) ?? [];

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

        send({ type: "total", total: rows.length });
        let checked = 0;

        for (const row of rows) {
          if (request.signal.aborted) break;
          let linked: AnilistMedia | null = null;
          let suggested: AnilistMedia | null = null;

          if (row.anilist_id) {
            try {
              linked = await fetchAnilist(row.anilist_id);
            } catch {
              linked = null;
            }
          }
          if (!linked) {
            try {
              const results = await searchAnilist(row.title, 4);
              suggested = results[0] ?? null;
            } catch {
              suggested = null;
            }
          }

          checked += 1;
          send({
            type: "result",
            result: {
              animeId: row.id,
              title: row.title,
              dbStatus: row.status,
              anilistId: row.anilist_id,
              linked,
              suggested,
            },
          });
          await new Promise((resolve) => setTimeout(resolve, 600));
        }

        send({ type: "done", total: rows.length, checked });
        try {
          controller.close();
        } catch {
          // already closed
        }
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

  return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ ok: false, error: "Admin login required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    animeId?: number;
    anilistId?: number | null;
  } | null;
  if (!body || !body.animeId) {
    return Response.json({ ok: false, error: "Missing animeId" }, { status: 400 });
  }

  const sb = adminClient(request);
  if (!sb) {
    return Response.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  }

  const { error } = await sb
    .from("anime")
    .update({ anilist_id: body.anilistId ?? null })
    .eq("id", body.animeId);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
