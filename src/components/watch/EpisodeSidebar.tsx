"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconSearch } from "../Icons";

interface Props {
  animeId: number;
  currentEp: number;
  total: number;
  episodeTitles: Record<number, string>;
  withVideo: number[];
  orientation: "vertical" | "horizontal";
}

const pad = (n: number) => String(n).padStart(2, "0");

function EpisodeButton({
  animeId,
  n,
  active,
  hasVideo,
}: {
  animeId: number;
  n: number;
  active: boolean;
  hasVideo: boolean;
}) {
  return (
    <Link
      href={`/anime/${animeId}/watch?ep=${n}`}
      aria-label={`Episode ${n}`}
      aria-current={active ? "true" : undefined}
      className={`relative flex h-11 shrink-0 items-center justify-center rounded-lg px-3 text-center text-[13px] font-bold transition duration-200 ${
        active
          ? "bg-gradient-btn text-white shadow-[0_6px_16px_rgba(124,92,255,0.45)]"
          : "bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {pad(n)}
      {hasVideo && (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
      )}
    </Link>
  );
}

export default function EpisodeSidebar({
  animeId,
  currentEp,
  total,
  episodeTitles,
  withVideo,
  orientation,
}: Props) {
  const [q, setQ] = useState("");
  const hasVideo = useMemo(() => new Set(withVideo), [withVideo]);

  const nums = useMemo(() => {
    const limit = Math.min(total, 500);
    const all = Array.from({ length: limit }, (_, i) => i + 1);
    const query = q.trim().toLowerCase();
    if (!query) return all;
    return all.filter(
      (n) =>
        String(n).includes(query) ||
        (episodeTitles[n] ?? "").toLowerCase().includes(query)
    );
  }, [q, total, episodeTitles]);

  const search =
    total > 24 ? (
      <label className="relative mx-4 mb-3 block">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search episode..."
          aria-label="Search episode"
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-[12.5px] text-white outline-none transition placeholder:text-muted focus:border-primary/60"
        />
      </label>
    ) : null;

  const legend =
    withVideo.length > 0 ? (
      <p className="flex items-center gap-1.5 border-t border-white/[0.06] px-5 py-3 text-[11.5px] text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        green dot = video available
      </p>
    ) : null;

  if (orientation === "vertical") {
    return (
      <aside className="sticky top-[88px] hidden max-h-[calc(100vh-112px)] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-panel/60 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm xl:flex">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-white">Episodes</h2>
          <span className="rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[11.5px] font-semibold text-muted">
            {total}
          </span>
        </div>
        {search}
        <div className="scroll-thin grid flex-1 grid-cols-4 content-start gap-2 overflow-y-auto px-4 pb-4 pt-1">
          {nums.map((n) => (
            <EpisodeButton
              key={n}
              animeId={animeId}
              n={n}
              active={n === currentEp}
              hasVideo={hasVideo.has(n)}
            />
          ))}
          {nums.length === 0 && (
            <p className="col-span-4 py-6 text-center text-[12.5px] text-muted">
              No matching episodes
            </p>
          )}
        </div>
        {legend}
      </aside>
    );
  }

  return (
    <div className="xl:hidden">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold text-white">Episodes</h2>
        <span className="text-[12px] font-semibold text-muted">
          {total} episode{total === 1 ? "" : "s"}
        </span>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {nums.map((n) => (
          <EpisodeButton
            key={n}
            animeId={animeId}
            n={n}
            active={n === currentEp}
            hasVideo={hasVideo.has(n)}
          />
        ))}
      </div>
      {withVideo.length > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          green dot = video available
        </p>
      )}
    </div>
  );
}
