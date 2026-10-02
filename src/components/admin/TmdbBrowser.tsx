"use client";

import TmdbPicker from "./TmdbPicker";

export default function TmdbBrowser() {
  return (
    <div className="rounded-xl border border-white/10 bg-panel p-6">
      <p className="mb-4 text-[13px] leading-6 text-muted">
        Search TMDB for anime titles, browse their posters and backdrops, preview images, and
        apply them to your anime records. Results come from the official TMDB API.
      </p>
      <TmdbPicker mode="tab" />
    </div>
  );
}
