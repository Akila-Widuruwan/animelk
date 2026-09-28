"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { SubtitleTrack } from "@/lib/db";

const HLS_EXT = /\.(m3u8)(\?|$)/i;

interface Props {
  videoUrl: string;
  poster?: string | null;
  subtitles?: SubtitleTrack[];
  ep?: number;
  title?: string;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function IconCC({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-current`}>
      <path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 4c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4zm6 0h1v8h-1V8z" />
    </svg>
  );
}

function IconGear({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-current`}>
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  );
}

export default function CustomPlayer({
  videoUrl,
  poster,
  subtitles = [],
  ep,
  title,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isHls = HLS_EXT.test(videoUrl);
  const defaultSubIndex = Math.max(
    0,
    subtitles.findIndex((s) => s.default)
  );

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const [level, setLevel] = useState(-1);
  const [activeSub, setActiveSub] = useState<number | null>(defaultSubIndex);
  const [menu, setMenu] = useState<"none" | "cc" | "quality">("none");
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!draggingRef.current && menuRef.current) setControlsVisible(false);
    }, 2600);
  }, []);

  const wake = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
    wake();
  }, [wake]);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.min(Math.max(v.currentTime + delta, 0), v.duration || 0);
      wake();
    },
    [wake]
  );

  const seekTo = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v || !Number.isFinite(t)) return;
      v.currentTime = Math.min(Math.max(t, 0), v.duration || 0);
    },
    []
  );

  const applySubtitle = useCallback((index: number | null) => {
    const v = videoRef.current;
    setActiveSub(index);
    if (!v) return;
    const tracks = Array.from(v.textTracks);
    tracks.forEach((t, i) => {
      t.mode = index === i ? "showing" : "disabled";
    });
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let hls: Hls | null = null;

    setTime(0);
    setDuration(0);
    setBuffered(0);
    setError("");
    setLevels([]);
    setLevel(-1);
    setMenu("none");

    if (isHls) {
      if (Hls.isSupported()) {
        hls = new Hls({ maxBufferLength: 30 });
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          const heights = (data.levels || []).map((l) => l.height);
          setLevels(heights);
          setLevel(-1);
          void v.play().catch(() => {});
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setLevel(data.level));
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            setError("Stream failed to load.");
            hls?.destroy();
          }
        });
      } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = videoUrl;
      } else {
        setError("This browser cannot play HLS streams.");
      }
    } else {
      v.src = videoUrl;
    }
    v.volume = volume;
    v.muted = muted;

    return () => {
      hls?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHls, videoUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);

  // apply the default subtitle once tracks are ready
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tryApply = () => {
      if (v.textTracks.length >= subtitles.length && subtitles.length > 0) {
        applySubtitle(defaultSubIndex);
      }
    };
    v.addEventListener("loadedmetadata", tryApply);
    return () => v.removeEventListener("loadedmetadata", tryApply);
  }, [subtitles.length, defaultSubIndex, applySubtitle]);

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void el.requestFullscreen().catch(() => {});
    }
    wake();
  }, [wake]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowright":
          seekBy(10);
          break;
        case "arrowleft":
          seekBy(-10);
          break;
        case "m":
          setMuted((m) => !m);
          break;
        case "f":
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, toggleFullscreen]);

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setTime(v.currentTime);
    if (v.buffered.length > 0) {
      setBuffered(v.buffered.end(v.buffered.length - 1));
    }
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration || 0);
  }, []);

  const onPointerMoveBar = useCallback((clientX: number) => {
    const bar = barRef.current;
    const v = videoRef.current;
    if (!bar || !v || !v.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    setTime(ratio * v.duration);
  }, []);

  const commitSeek = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      const v = videoRef.current;
      if (!bar || !v || !v.duration) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      seekTo(ratio * v.duration);
    },
    [seekTo]
  );

  const pickLevel = useCallback(
    (index: number) => {
      const hls = hlsRef.current;
      if (!hls) return;
      if (index === -1) hls.currentLevel = -1;
      else if (hls.levels[index]) hls.currentLevel = index;
      setMenu("none");
      wake();
    },
    [wake]
  );

  const progress = duration > 0 ? (time / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const currentLevelHeight = level >= 0 && levels[level] ? levels[level] : null;

  return (
    <div
      ref={wrapRef}
      className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.06]"
      onMouseMove={wake}
      onMouseLeave={() => {
        if (!playing) setControlsVisible(true);
      }}
      onTouchStart={wake}
    >
      <video
        ref={videoRef}
        key={videoUrl}
        className="h-full w-full"
        poster={poster || undefined}
        playsInline
        autoPlay
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={() => {
          setPlaying(true);
          scheduleHide();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onEnded={() => setControlsVisible(true)}
        onError={() => setError("Failed to load video.")}
        crossOrigin="anonymous"
      >
        {subtitles.map((s, i) => (
          <track
            key={`${s.url}-${i}`}
            kind="subtitles"
            src={s.url}
            srcLang={s.lang || "en"}
            label={s.label || `Track ${i + 1}`}
            default={i === defaultSubIndex}
          />
        ))}
      </video>

      {ep ? (
        <span className="pointer-events-none absolute left-4 top-4 rounded bg-black/70 px-2.5 py-1 text-xs font-bold text-white">
          EP {ep}
        </span>
      ) : null}

      {waiting && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#05060f]/95 p-6 text-center">
          <p className="text-sm font-semibold text-red-300">{error}</p>
          <button
            onClick={() => {
              setError("");
              const v = videoRef.current;
              if (v) v.load();
            }}
            className="rounded-full border border-white/15 px-5 py-2 text-[13px] font-semibold text-white transition hover:border-primary hover:bg-primary/20"
          >
            Retry
          </button>
        </div>
      )}

      {/* big center play overlay */}
      {!playing && !error && duration > 0 && (
        <button
          onClick={togglePlay}
          aria-label="Play"
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 backdrop-blur transition hover:scale-105 hover:bg-primary/80"
        >
          <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      <div
        ref={menuRef}
        className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          ref={barRef}
          className="group/bar relative h-4 cursor-pointer"
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            onPointerMoveBar(e.clientX);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) onPointerMoveBar(e.clientX);
          }}
          onPointerUp={(e) => {
            draggingRef.current = false;
            commitSeek(e.clientX);
            wake();
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white/30"
              style={{ width: `${bufferedPct}%` }}
            />
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-btn"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/bar:opacity-100"
            style={{ left: `${progress}%` }}
          />
        </div>

        <div className="mt-1 flex items-center gap-2">
          <button
            onClick={() => seekBy(-10)}
            aria-label="Back 10 seconds"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z" />
            </svg>
          </button>
          <button
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          >
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => seekBy(10)}
            aria-label="Forward 10 seconds"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M13 6v12l8.5-6L13 6zM4 18l8.5-6L4 6v12z" />
            </svg>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Unmute" : "Mute"}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                {muted || volume === 0 ? (
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                ) : (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                )}
              </svg>
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                setMuted(Number(e.target.value) === 0);
                wake();
              }}
              aria-label="Volume"
              className="h-1 w-16 cursor-pointer accent-[#7b61ff] sm:w-20"
            />
          </div>

          <span className="shrink-0 text-xs font-semibold tabular-nums text-white/90">
            {formatTime(time)}
            <span className="text-white/50"> / {formatTime(duration)}</span>
          </span>

          <div className="flex-1" />

          {/* CC / subtitles */}
          {subtitles.length > 0 && (
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  setMenu(menu === "cc" ? "none" : "cc");
                  wake();
                }}
                aria-label="Subtitles"
                className={`flex h-8 items-center gap-1.5 rounded px-2 text-xs font-bold transition hover:bg-white/10 ${
                  activeSub !== null ? "text-primary" : "text-white"
                }`}
              >
                <IconCC />
              </button>
              {menu === "cc" && (
                <div className="absolute bottom-10 right-0 z-20 w-44 overflow-hidden rounded-lg border border-white/10 bg-[#0b0d1a] py-1 shadow-xl">
                  <button
                    onClick={() => {
                      applySubtitle(null);
                      setMenu("none");
                      wake();
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold transition hover:bg-white/10 ${
                      activeSub === null ? "text-primary" : "text-white/80"
                    }`}
                  >
                    Off
                    {activeSub === null && <span className="text-primary">✓</span>}
                  </button>
                  {subtitles.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        applySubtitle(i);
                        setMenu("none");
                        wake();
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold transition hover:bg-white/10 ${
                        activeSub === i ? "text-primary" : "text-white/80"
                      }`}
                    >
                      {s.label || `Track ${i + 1}`}
                      {activeSub === i && <span className="text-primary">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* quality */}
          {levels.length > 1 && (
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  setMenu(menu === "quality" ? "none" : "quality");
                  wake();
                }}
                aria-label="Quality"
                className="flex h-8 items-center gap-1 rounded px-2 text-xs font-bold text-white transition hover:bg-white/10"
              >
                <IconGear className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {currentLevelHeight ? `${currentLevelHeight}p` : "Auto"}
                </span>
              </button>
              {menu === "quality" && (
                <div className="absolute bottom-10 right-0 z-20 w-32 overflow-hidden rounded-lg border border-white/10 bg-[#0b0d1a] py-1 shadow-xl">
                  <button
                    onClick={() => pickLevel(-1)}
                    className={`block w-full px-3 py-1.5 text-left text-xs font-semibold transition hover:bg-white/10 ${
                      level === -1 ? "text-primary" : "text-white/80"
                    }`}
                  >
                    Auto
                  </button>
                  {levels.map((h, i) => (
                    <button
                      key={h}
                      onClick={() => pickLevel(i)}
                      className={`block w-full px-3 py-1.5 text-left text-xs font-semibold transition hover:bg-white/10 ${
                        level === i ? "text-primary" : "text-white/80"
                      }`}
                    >
                      {h}p
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          </button>
        </div>
      </div>

      {title && (
        <span className="pointer-events-none absolute right-4 top-4 max-w-[50%] truncate rounded bg-black/70 px-2.5 py-1 text-xs font-bold text-white/90">
          {title}
        </span>
      )}
    </div>
  );
}
