"use client";

import { useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Anime } from "@/lib/anime";
import type { SubtitleTrack } from "@/lib/db";
import { streamUrl, serverSources } from "@/lib/stream";
import type { VideoSource } from "@/lib/stream";
import { IconPlay } from "./Icons";
import CustomPlayer from "./CustomPlayer";

const MkvPlayer = dynamic(() => import("./MkvPlayer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  ),
});

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|$)/i;
const HLS_EXT = /\.(m3u8)(\?|$)/i;
const MKV_EXT = /\.(mkv)(\?|$)/i;

interface Props {
  anime: Anime;
  ep: number;
  videoUrl: string | null;
  episodeTitle?: string | null;
  hasEpisodeRow?: boolean;
  subtitles?: SubtitleTrack[];
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
}

export default function WatchPlayer({
  anime,
  ep,
  videoUrl,
  episodeTitle,
  hasEpisodeRow,
  subtitles = [],
  hasPrevEpisode = false,
  hasNextEpisode = false,
}: Props) {
  const router = useRouter();
  const [demo, setDemo] = useState(false);
  const [server, setServer] = useState(0);

  const slots = videoUrl ? serverSources(videoUrl) : [];
  const available = slots.filter((s): s is VideoSource => Boolean(s));
  const activeIndex = Math.min(server, Math.max(available.length - 1, 0));
  const activeSource = available[activeIndex] ?? null;
  const playableUrl = activeSource?.url ?? null;
  const rawUrl = activeSource?.raw ?? "";
  const playableSubtitles = subtitles.map((s) =>
    s.url ? { ...s, url: streamUrl(s.url) } : s
  );

  const isHls = !!rawUrl && HLS_EXT.test(rawUrl);
  const isDirect = !!rawUrl && VIDEO_EXT.test(rawUrl);
  const isMkv = !!rawUrl && MKV_EXT.test(rawUrl);
  const isEmbed = !!rawUrl && !isHls && !isDirect && !isMkv;

  const serverRow =
    available.length > 1 ? (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-muted">
          Server
        </span>
        {slots.map((s, i) => {
          if (!s) return null;
          const active = i === activeIndex;
          return (
            <button
              key={i}
              onClick={() => setServer(i)}
              className={`flex h-10 items-center gap-1.5 rounded-full border px-4 text-[13px] font-bold transition duration-200 ${
                active
                  ? "border-primary bg-primary/20 text-white"
                  : "border-white/15 bg-white/5 text-white/70 hover:border-violet-2/70 hover:bg-violet-2/15 hover:text-white"
              }`}
            >
              0{i + 1}
              {s.multi ? (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold leading-none ${
                    active ? "bg-primary/30 text-white" : "bg-white/10 text-white/60"
                  }`}
                >
                  Multi
                </span>
              ) : s.height ? (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold leading-none ${
                    active ? "bg-primary/30 text-white" : "bg-white/10 text-white/60"
                  }`}
                >
                  {s.height}p
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    ) : null;

  if (isMkv) {
    return (
      <>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.06]">
          <div className="absolute inset-0">
            <MkvPlayer
              key={playableUrl}
              videoUrl={playableUrl!}
              poster={anime.bannerImage || anime.coverImage}
              title={episodeTitle ?? undefined}
              subtitles={playableSubtitles}
            />
          </div>
        </div>
        {serverRow}
      </>
    );
  }

  if (isEmbed) {
    return (
      <>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.06]">
          <iframe
            src={playableUrl}
            title={episodeTitle ? `Episode ${ep} — ${episodeTitle}` : `${anime.title} episode ${ep}`}
            className="absolute inset-0 h-full w-full"
            allowFullScreen
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            scrolling="no"
          />
        </div>
        {serverRow}
      </>
    );
  }

  if (isDirect || isHls) {
    return (
      <>
        <CustomPlayer
          key={playableUrl}
          videoUrl={playableUrl!}
          poster={anime.bannerImage || anime.coverImage || undefined}
          subtitles={playableSubtitles}
          ep={ep}
          title={episodeTitle ?? undefined}
          animeTitle={anime.title}
          animeId={anime.id}
          hasPrev={hasPrevEpisode}
          hasNext={hasNextEpisode}
          onNavigateEpisode={(n) =>
            router.push(`/anime/${anime.id}/watch?ep=${n}`)
          }
        />
        {serverRow}
      </>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {demo ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-[#05060f]">
          <div className="flex h-14 items-end gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="eq-bar bg-gradient-btn w-2.5 rounded-full"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="max-w-md px-6 text-sm font-semibold text-white/80">
            {hasEpisodeRow
              ? "No video uploaded for this episode yet — add the video URL in Admin → Episodes."
              : "Demo player — connect your video source here"}
          </p>
          <button
            onClick={() => setDemo(false)}
            className="rounded-full border border-white/15 px-5 py-2 text-[13px] font-semibold text-white transition hover:border-primary hover:bg-primary/20"
          >
            Stop
          </button>
        </div>
      ) : (
        <button
          onClick={() => setDemo(true)}
          className="group absolute inset-0"
          aria-label="Play"
        >
          {anime.bannerImage || anime.coverImage ? (
            <Image
              src={anime.bannerImage || anime.coverImage}
              alt={anime.title}
              fill
              sizes="100vw"
              className="object-cover opacity-70"
            />
          ) : (
            <span className="absolute inset-0 bg-panel-2" />
          )}
          <div className="absolute inset-0 bg-black/45 transition group-hover:bg-black/30" />
          <span className="bg-gradient-btn absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-[0_15px_40px_rgba(123,97,255,0.5)] transition duration-300 group-hover:scale-110">
            <IconPlay className="h-7 w-7" />
          </span>
          <span className="absolute left-4 top-4 rounded bg-black/70 px-2.5 py-1 text-xs font-bold text-white">
            EP {ep}
          </span>
        </button>
      )}
    </div>
  );
}
