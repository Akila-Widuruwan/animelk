"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Anime } from "@/lib/anime";
import { ageRating, metaTime, qualityBadges, score, year } from "@/lib/anime";
import type { SubtitleTrack } from "@/lib/db";
import { IconBookmark, IconCheck, IconShare, IconStar } from "../Icons";
import ExternalPlayerButtons from "../ExternalPlayerButtons";

const LS_KEY = "animelk-watchlist";

interface Props {
  anime: Anime;
  ep: number;
  episodeTitle: string | null;
  isMovie: boolean;
  videoUrl?: string | null;
  subtitles?: SubtitleTrack[];
}

export default function AnimeWatchInfo({
  anime,
  ep,
  episodeTitle,
  isMovie,
  videoUrl,
  subtitles = [],
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [listed, setListed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          setListed((JSON.parse(raw) as number[]).includes(anime.id));
        }
      } catch {
        // storage unavailable
      }
    }, 0);
    return () => clearTimeout(t);
  }, [anime.id]);

  const toggleList = () => {
    setListed((v) => {
      const next = !v;
      try {
        const raw = localStorage.getItem(LS_KEY);
        const arr = raw ? (JSON.parse(raw) as number[]) : [];
        const set = new Set(arr);
        if (next) set.add(anime.id);
        else set.delete(anime.id);
        localStorage.setItem(LS_KEY, JSON.stringify([...set]));
      } catch {
        // storage unavailable
      }
      return next;
    });
  };

  const share = async () => {
    const url = window.location.href;
    const title = `${anime.title} — ${isMovie ? "Movie" : `Episode ${ep}`}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      throw new Error("no-share-api");
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // clipboard unavailable
      }
    }
  };

  const longDesc = (anime.description ?? "").length > 240;

  return (
    <div className="mt-8 flex gap-5">
      <Link
        href={`/anime/${anime.id}`}
        aria-label={anime.title}
        className="relative hidden aspect-[2/3] w-[110px] shrink-0 overflow-hidden rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.08] transition duration-300 hover:scale-[1.03] sm:block md:w-[150px]"
      >
        {anime.coverImage ? (
          <Image
            src={anime.coverImage}
            alt={anime.title}
            fill
            sizes="150px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-panel-2 text-[11px] font-semibold text-muted">
            No image
          </span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-white md:text-[30px]">
          {anime.title}
        </h1>
        <p className="mt-1.5 text-[14px] font-bold text-violet-2">
          {isMovie
            ? "Full Movie"
            : `Episode ${ep}${episodeTitle ? ` — ${episodeTitle}` : ""}`}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] font-bold text-[#f5c518]">
            <IconStar className="h-3 w-3" />
            {score(anime)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] font-bold text-white">
            {ageRating(anime)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] font-semibold text-white/80">
            {year(anime)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] font-semibold text-white/80">
            {metaTime(anime)}
          </span>
          {qualityBadges(anime).map((b) => (
            <span
              key={b.label}
              style={{ background: b.color }}
              className="rounded-full px-2.5 py-1 text-[12px] font-bold leading-none text-white"
            >
              {b.label}
            </span>
          ))}
        </div>

        <p
          className={`mt-4 max-w-[850px] text-[14.5px] leading-[1.7] text-body ${
            expanded ? "" : "line-clamp-3"
          }`}
        >
          {anime.description || "No description available."}
        </p>
        {longDesc && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-[13px] font-bold text-violet-2 transition hover:text-white"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={toggleList}
            className={`flex h-11 items-center gap-2 rounded-full px-6 text-[13.5px] font-bold transition duration-200 ${
              listed
                ? "border border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : "border border-white/15 bg-white/5 text-white hover:border-violet-2/70 hover:bg-violet-2/15"
            }`}
          >
            {listed ? <IconCheck className="h-4 w-4" /> : <IconBookmark className="h-4 w-4" />}
            {listed ? "In Your List" : "Add to List"}
          </button>
          <button
            onClick={share}
            className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-[13.5px] font-bold text-white transition duration-200 hover:border-violet-2/70 hover:bg-violet-2/15"
          >
            <IconShare className="h-4 w-4" />
            {copied ? "Link Copied" : "Share"}
          </button>
        </div>

        {videoUrl && (
          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted">
              Open in external player
            </p>
            <ExternalPlayerButtons videoUrl={videoUrl} subtitles={subtitles} />
          </div>
        )}
      </div>
    </div>
  );
}
