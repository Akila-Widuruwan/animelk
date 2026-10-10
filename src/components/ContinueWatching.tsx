"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { allAnime } from "@/lib/anime";
import { fetchContinueWatching } from "@/lib/viewer-data";
import { useViewer } from "@/lib/viewer-auth";
import { IconPlay } from "./Icons";

const RESUME_PREFIX = "animelk-resume";

interface ResumeItem {
  animeId: number;
  ep: number;
  time: number;
  title: string;
  image: string | null;
  durationMin: number | null;
}

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m <= 0) return "almost done";
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m left`;
}

/**
 * Signed-out visitors resume from the browser's own saved positions, the way
 * the site worked before accounts existed.
 */
async function collectLocal(): Promise<ResumeItem[]> {
  const entries: { animeId: number; ep: number; time: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(RESUME_PREFIX)) continue;
      const m = key.match(/^animelk-resume-(\d+)-(\d+)$/);
      if (!m) continue;
      const time = Number(localStorage.getItem(key));
      if (!Number.isFinite(time) || time < 60) continue;
      entries.push({ animeId: Number(m[1]), ep: Number(m[2]), time });
    }
  } catch {
    return [];
  }
  if (entries.length === 0) return [];

  const ids = [...new Set(entries.map((e) => e.animeId))];
    const meta = new Map<number, { title: string; image: string | null; durationMin: number | null }>();
    const hidden = new Set<number>();
    try {
      const sb = supabaseBrowser();
      const { data } = await sb
        .from("anime")
        .select("id, title, cover_image, banner_image, duration, is_active")
        .in("id", ids);
      for (const a of (data as Record<string, unknown>[] | null) ?? []) {
        // Titles switched OFF in the admin panel are hidden from the public
        // site, including this resume row.
        if (a.is_active === false) {
          hidden.add(a.id as number);
          continue;
        }
        meta.set(a.id as number, {
          title: a.title as string,
          image: (a.banner_image as string) || (a.cover_image as string) || null,
          durationMin: (a.duration as number) ?? null,
        });
      }
    } catch {
      // fall back to static data below
    }
    const staticById = new Map(allAnime.map((a) => [a.id, a]));
    return entries
      .filter((e) => !hidden.has(e.animeId))
    .map((e) => {
      const db = meta.get(e.animeId);
      const st = staticById.get(e.animeId);
      return {
        animeId: e.animeId,
        ep: e.ep,
        time: e.time,
        title: db?.title ?? st?.title ?? `Anime #${e.animeId}`,
        image: db?.image ?? st?.bannerImage ?? st?.coverImage ?? null,
        durationMin: db?.durationMin ?? (st && st.duration > 0 ? st.duration : null),
      };
    });
}

export default function ContinueWatching() {
  const [items, setItems] = useState<ResumeItem[] | null>(null);
  const { viewer, loading } = useViewer();

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    void (async () => {
      const rows = viewer ? await fetchContinueWatching(12) : await collectLocal();
      if (!cancelled) setItems(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, viewer]);

  if (!items || items.length === 0) return null;

  return (
    <section className="container-site mb-4 sm:mb-6 lg:mb-8">
      <h5 className="mb-3 text-[18px] font-extrabold tracking-tight text-white sm:mb-4 sm:text-[20px] md:text-[22px]">
        Continue Watching
      </h5>
      <div className="no-scrollbar -mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2 [-webkit-overflow-scrolling:touch] md:snap-proximity md:gap-5">
        {items.map((it) => {
          const totalSec = it.durationMin ? it.durationMin * 60 : 0;
          const pct =
            totalSec > 0 ? Math.min(100, Math.round((it.time / totalSec) * 100)) : 0;
          const remaining =
            totalSec > 0 ? formatRemaining(Math.max(0, totalSec - it.time)) : "";
          return (
            <Link
              key={`${it.animeId}-${it.ep}`}
              href={`/anime/${it.animeId}/watch?ep=${it.ep}`}
              className="group relative aspect-video w-[74vw] max-w-[340px] shrink-0 snap-start overflow-hidden rounded-xl bg-panel ring-1 ring-white/[0.06] transition duration-300 hover:ring-primary/40 sm:w-[280px] md:w-[320px] lg:w-[340px]"
            >
              {it.image ? (
                <Image
                  src={it.image}
                  alt={it.title}
                  fill
                  sizes="(max-width:640px) 74vw, (max-width:768px) 280px, (max-width:1024px) 320px, 340px"
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-panel-2 text-[11px] font-semibold text-muted">
                  No image
                </span>
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />
              <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm">
                <IconPlay className="h-5 w-5 translate-x-[1px]" />
              </span>
              <span className="absolute inset-x-3 bottom-3">
                <span className="block truncate text-[13px] font-bold text-white">
                  {it.title}
                </span>
                <span className="mt-0.5 block text-[11px] font-semibold text-white/70">
                  Episode {it.ep}
                  {remaining ? ` · ${remaining}` : ""}
                </span>
                {totalSec > 0 && (
                  <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-white/25">
                    <span
                      className="block h-full rounded-full bg-gradient-btn"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
