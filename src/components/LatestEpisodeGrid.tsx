"use client";

import { useEffect, useRef, useState } from "react";
import type { Anime } from "@/lib/anime";
import AnimeCard from "./AnimeCard";

/**
 * "Latest Episode" row.
 *
 * A single responsive CSS grid (never a horizontal carousel) that shows the
 * newest episodes first and caps the result at three rows, so the section never
 * grows unbounded across breakpoints. Cards wrap naturally; no duplicated
 * titles; no horizontal page overflow.
 *
 * Columns: 2 (mobile) → 3 (sm) → 4 (md) → 6 (lg) → 7 (xl) → 8 (2xl), matching
 * the requirement of ~7-8 cards per desktop row and ~2-3 on mobile.
 */
export default function LatestEpisodeGrid({ items }: { items: Anime[] }) {
  const ref = useRef<HTMLDivElement>(null);
  // Render everything on the server/first paint, then trim to three rows once
  // the real column count is known.
  const [max, setMax] = useState(items.length);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const tracks = getComputedStyle(el)
        .gridTemplateColumns.split(" ")
        .filter(Boolean).length;
      // Each unique anime appears exactly once; never pad rows with duplicates.
      setMax(tracks > 0 ? Math.min(items.length, tracks * 3) : items.length);
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  const shown = items.slice(0, max);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-panel/40 px-6 py-10 text-center text-[13px] font-semibold text-muted">
        No episodes available yet. Check back soon.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8"
    >
      {shown.map((a) => (
        <AnimeCard key={a.id} anime={a} variant="grid" episode={a.lastEpisode} />
      ))}
    </div>
  );
}
