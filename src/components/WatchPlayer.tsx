"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Hls from "hls.js";
import type { Anime } from "@/lib/anime";
import { IconPlay } from "./Icons";

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|$)/i;
const HLS_EXT = /\.(m3u8)(\?|$)/i;

interface Props {
  anime: Anime;
  ep: number;
  videoUrl: string | null;
  episodeTitle?: string | null;
  hasEpisodeRow?: boolean;
}

export default function WatchPlayer({
  anime,
  ep,
  videoUrl,
  episodeTitle,
  hasEpisodeRow,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);

  const isHls = !!videoUrl && HLS_EXT.test(videoUrl);
  const isDirect = !!videoUrl && VIDEO_EXT.test(videoUrl);
  const isEmbed = !!videoUrl && !isHls && !isDirect;

  useEffect(() => {
    if (!isHls || !videoRef.current || !videoUrl) return;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(videoUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setError("Stream failed to load. Check the episode URL in Admin → Episodes.");
          hls.destroy();
        }
      });
      return () => hls.destroy();
    }
    if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      videoRef.current.src = videoUrl;
    } else {
      setError("This browser cannot play HLS streams.");
    }
  }, [isHls, videoUrl]);

  if (isEmbed) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.06]">
        <iframe
          src={videoUrl}
          title={episodeTitle ? `Episode ${ep} — ${episodeTitle}` : `${anime.title} episode ${ep}`}
          className="absolute inset-0 h-full w-full"
          allowFullScreen
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          scrolling="no"
        />
      </div>
    );
  }

  if (isDirect || isHls) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.06]">
        <video
          key={videoUrl}
          ref={videoRef}
          controls
          autoPlay
          playsInline
          poster={anime.bannerImage || anime.coverImage || undefined}
          className="h-full w-full"
          onError={() =>
            setError("Failed to load video. Check the episode URL in Admin → Episodes.")
          }
        >
          {isDirect && <source src={videoUrl} />}
        </video>
        <span className="pointer-events-none absolute left-4 top-4 rounded bg-black/70 px-2.5 py-1 text-xs font-bold text-white">
          EP {ep}
        </span>
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#05060f]/95 p-6 text-center">
            <p className="text-sm font-semibold text-red-300">{error}</p>
            <button
              onClick={() => setError("")}
              className="rounded-full border border-white/15 px-5 py-2 text-[13px] font-semibold text-white transition hover:border-primary hover:bg-primary/20"
            >
              Retry
            </button>
          </div>
        )}
      </div>
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
