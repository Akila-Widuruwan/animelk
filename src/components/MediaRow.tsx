"use client";

import type { Anime } from "@/lib/anime";
import Carousel from "./Carousel";
import AnimeCard from "./AnimeCard";

export default function MediaRow({
  items,
  panel = false,
  episodeLinks = false,
}: {
  items: Anime[];
  panel?: boolean;
  /** Link each card to the anime's last episode instead of its detail page. */
  episodeLinks?: boolean;
}) {
  if (items.length === 0) {
    const empty = (
      <div className="rounded-2xl border border-white/[0.06] bg-panel/40 px-6 py-10 text-center text-[13px] font-semibold text-muted">
        No titles to show here yet. Check back soon.
      </div>
    );
    return panel ? (
      <div className="rounded-2xl bg-panel/50 p-4 ring-1 ring-white/[0.05] md:p-6">
        {empty}
      </div>
    ) : (
      empty
    );
  }

  const list = (
    <Carousel className="items-stretch">
      {items.map((a) => (
        <AnimeCard
          key={a.id}
          anime={a}
          variant="carousel"
          episode={episodeLinks ? a.lastEpisode : undefined}
        />
      ))}
    </Carousel>
  );

  if (panel) {
    return (
      <div className="rounded-2xl bg-panel/50 p-4 ring-1 ring-white/[0.05] md:p-6">
        {list}
      </div>
    );
  }
  return list;
}
