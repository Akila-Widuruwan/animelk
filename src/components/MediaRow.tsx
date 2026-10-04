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
