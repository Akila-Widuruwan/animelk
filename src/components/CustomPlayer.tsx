"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Hls from "hls.js";
import type { SubtitleTrack } from "@/lib/db";

const HLS_EXT = /\.(m3u8)(\?|$)/i;
const RESUME_PREFIX = "animelk-resume";
const RESUME_SAVE_INTERVAL = 10_000;
const RESUME_MIN = 5;
const RESUME_MAX_MARGIN = 30;

interface Props {
  videoUrl: string;
  poster?: string | null;
  subtitles?: SubtitleTrack[];
  ep?: number;
  title?: string;
  animeTitle?: string;
  animeId?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
  onNavigateEpisode?: (ep: number) => void;
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

/* ---------------------------- icon system ---------------------------- */
/* Single stroke-based outline family. Every glyph is drawn inside the same
   24x24 viewBox, strokeWidth 2, and optically centered — no CSS offsets. */

interface IconProps {
  size?: number;
  className?: string;
}

function I({
  size = 20,
  className = "",
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ width: size, height: size, flex: "none" }}
    >
      {children}
    </svg>
  );
}

const IconPlay = (p: IconProps) => (
  <I {...p}>
    <path d="M8 5.5v13l9-6.5z" />
  </I>
);

const IconPause = (p: IconProps) => (
  <I {...p}>
    <path d="M7.5 5.5v13" />
    <path d="M16.5 5.5v13" />
  </I>
);

const IconPrevEp = (p: IconProps) => (
  <I {...p}>
    <path d="M6 6v12" />
    <path d="M19 6.5v11l-8.5-5.5z" />
  </I>
);

const IconNextEp = (p: IconProps) => (
  <I {...p}>
    <path d="M18 6v12" />
    <path d="M5 6.5v11l8.5-5.5z" />
  </I>
);

const IconBack10 = (p: IconProps) => (
  <I {...p}>
    <path d="M4.6 12a7.4 7.4 0 1 0 7.4-7.4 7.7 7.7 0 0 0-5.3 2.2L4.6 8.6" />
    <path d="M4.6 4.6v4h4" />
    <text
      x="12"
      y="13.2"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="8.6"
      fontWeight="800"
      fill="currentColor"
      stroke="none"
    >
      10
    </text>
  </I>
);

const IconFwd10 = (p: IconProps) => (
  <I {...p}>
    <path d="M19.4 12a7.4 7.4 0 1 1-7.4-7.4 7.7 7.7 0 0 1 5.3 2.2L19.4 8.6" />
    <path d="M19.4 4.6v4h-4" />
    <text
      x="12"
      y="13.2"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="8.6"
      fontWeight="800"
      fill="currentColor"
      stroke="none"
    >
      10
    </text>
  </I>
);

const IconVolumeHigh = (p: IconProps) => (
  <I {...p}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
    <path d="M15.5 9.2a4.3 4.3 0 0 1 0 5.6" />
    <path d="M18 7a7.6 7.6 0 0 1 0 10" />
  </I>
);

const IconVolumeLow = (p: IconProps) => (
  <I {...p}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
    <path d="M15.5 9.2a4.3 4.3 0 0 1 0 5.6" />
  </I>
);

const IconVolumeMuted = (p: IconProps) => (
  <I {...p}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
    <path d="m16.5 9.5 5 5" />
    <path d="m21.5 9.5-5 5" />
  </I>
);

const IconSubs = (p: IconProps) => (
  <I {...p}>
    <rect x="1.5" y="5" width="21" height="14" rx="2" />
    <path d="M6.5 9h2.5" />
    <path d="M6.5 12h2" />
    <path d="M6.5 15h2" />
    <path d="M12.5 12.5h5" />
    <path d="M12.5 15.5h5" />
  </I>
);

const IconSpeed = (p: IconProps) => (
  <I {...p}>
    <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z" />
    <path d="M12 7.5V12l3.2 2.1" />
  </I>
);

const IconQuality = (p: IconProps) => (
  <I {...p}>
    <rect x="1.5" y="6" width="21" height="12" rx="2" />
    <text
      x="12"
      y="12.6"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="7.5"
      fontWeight="800"
      fill="currentColor"
      stroke="none"
    >
      HD
    </text>
  </I>
);

const IconSettings = (p: IconProps) => (
  <I {...p}>
    <path d="M4 7h10" />
    <path d="M18 7h2" />
    <path d="M4 12h4" />
    <path d="M12 12h8" />
    <path d="M4 17h7" />
    <path d="M15 17h5" />
    <circle cx="16" cy="7" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="10" cy="12" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="13" cy="17" r="1.8" fill="currentColor" stroke="none" />
  </I>
);

const IconPip = (p: IconProps) => (
  <I {...p}>
    <rect x="1.5" y="4.5" width="21" height="15" rx="2" />
    <path d="M12.5 11.5h7a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-7a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5Z" />
  </I>
);

const IconFullscreen = (p: IconProps) => (
  <I {...p}>
    <path d="M8.5 4H4v4.5" />
    <path d="M15.5 4H20v4.5" />
    <path d="M20 15.5V20h-4.5" />
    <path d="M4 15.5V20h4.5" />
  </I>
);

const IconExitFullscreen = (p: IconProps) => (
  <I {...p}>
    <path d="M4 9.5V4h5.5" />
    <path d="M14.5 4H20v5.5" />
    <path d="M20 14.5V20h-5.5" />
    <path d="M9.5 20H4v-5.5" />
  </I>
);

const IconCheck = (p: IconProps) => (
  <I {...p}>
    <path d="m4.5 12.5 5 5L19.5 7" />
  </I>
);

const IconRetry = (p: IconProps) => (
  <I {...p}>
    <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
    <path d="M20.5 3.5V8H16" />
  </I>
);

/* ------------------------------ button system ------------------------------ */

const CTRL_BTN =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/90 transition-colors duration-150 hover:bg-white/10 hover:text-white active:bg-white/[0.16] disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-10 sm:w-10";

const PLAY_BTN =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white transition-colors duration-150 hover:bg-white/10 hover:text-white active:bg-white/[0.16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const SEEK_BTN =
  "group/seek relative mx-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-all duration-150 hover:bg-white/15 hover:text-white active:scale-[0.85] active:bg-white/20 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-10 sm:w-10";

function SeekTooltip({
  label,
  align = "center",
}: {
  label: string;
  align?: "center" | "start";
}) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute -top-9 z-40 whitespace-nowrap rounded-md bg-black/85 px-2 py-0.5 text-[11px] font-semibold text-white opacity-0 ring-1 ring-white/10 transition-opacity duration-150 group-hover/seek:opacity-100 group-focus-visible/seek:opacity-100 ${
        align === "start" ? "left-0" : "left-1/2 -translate-x-1/2"
      }`}
    >
      {label}
    </span>
  );
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/* ------------------------------- component ------------------------------- */

export default function CustomPlayer({
  videoUrl,
  poster,
  subtitles = [],
  ep,
  title,
  animeTitle,
  animeId,
  hasPrev = false,
  hasNext = false,
  onNavigateEpisode,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isHls = HLS_EXT.test(videoUrl);
  const defaultSubIndex = Math.max(
    0,
    subtitles.findIndex((s) => s.default)
  );
  const resumeKey =
    animeId && ep ? `${RESUME_PREFIX}-${animeId}-${ep}` : null;

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const [level, setLevel] = useState(-1);
  const [rate, setRate] = useState(1);
  const [activeSub, setActiveSub] = useState<number | null>(defaultSubIndex);
  const [menu, setMenu] = useState<"none" | "settings">("none");
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [seekFlash, setSeekFlash] = useState<{
    dir: "back" | "fwd";
    id: number;
  } | null>(null);

  const seekFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const menuOpen = menu !== "none";
  const draggingRefState = useRef(dragging);
  const menuOpenStateRef = useRef(menuOpen);

  useEffect(() => {
    menuOpenStateRef.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    draggingRefState.current = dragging;
  }, [dragging]);

  /* single control-visibility mechanism */
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (
        !draggingRefState.current &&
        !menuOpenStateRef.current &&
        videoRef.current &&
        !videoRef.current.paused
      ) {
        setControlsVisible(false);
      }
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
      const dur = Number.isFinite(v.duration) ? v.duration : 0;
      if (dur <= 0) return;
      v.currentTime = Math.min(Math.max(v.currentTime + delta, 0), dur);
      wake();
    },
    [wake]
  );

  const seekTo = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(t)) return;
    v.currentTime = Math.min(Math.max(t, 0), v.duration || 0);
  }, []);

  const flashSeek = useCallback((dir: "back" | "fwd") => {
    setSeekFlash((prev) => ({ dir, id: (prev?.id ?? 0) + 1 }));
    if (seekFlashTimer.current) clearTimeout(seekFlashTimer.current);
    seekFlashTimer.current = setTimeout(() => setSeekFlash(null), 700);
  }, []);

  useEffect(() => {
    return () => {
      if (seekFlashTimer.current) clearTimeout(seekFlashTimer.current);
    };
  }, []);

  const applySubtitle = useCallback((index: number | null) => {
    const v = videoRef.current;
    setActiveSub(index);
    if (!v) return;
    const tracks = Array.from(v.textTracks);
    tracks.forEach((t, i) => {
      t.mode = index === i ? "showing" : "disabled";
    });
  }, []);

  const saveResume = useCallback(() => {
    const v = videoRef.current;
    if (!resumeKey || !v || !v.duration) return;
    if (v.currentTime < RESUME_MIN || v.currentTime > v.duration - RESUME_MAX_MARGIN) {
      return;
    }
    try {
      localStorage.setItem(resumeKey, String(Math.floor(v.currentTime)));
    } catch {
      // storage unavailable
    }
  }, [resumeKey]);

  /* source setup */
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
    setLoaded(false);
    setWaiting(false);
    setRate(1);

    if (isHls) {
      if (Hls.isSupported()) {
        hls = new Hls({ maxBufferLength: 30 });
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          setLevels((data.levels || []).map((l) => l.height));
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
    v.playbackRate = 1;

    return () => {
      hls?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHls, videoUrl, retryKey]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);

  /* resume restore */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !resumeKey) return;
    const tryRestore = () => {
      if (!v.duration) return;
      try {
        const raw = localStorage.getItem(resumeKey);
        if (!raw) return;
        const t = Number(raw);
        if (Number.isFinite(t) && t > RESUME_MIN && t < v.duration - RESUME_MAX_MARGIN) {
          v.currentTime = t;
          setTime(t);
        }
      } catch {
        // storage unavailable
      }
    };
    v.addEventListener("loadedmetadata", tryRestore);
    return () => v.removeEventListener("loadedmetadata", tryRestore);
  }, [resumeKey, videoUrl]);

  /* periodic progress saving */
  useEffect(() => {
    saveTimer.current = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) saveResume();
    }, RESUME_SAVE_INTERVAL);
    const onHide = () => {
      if (document.hidden) saveResume();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      if (saveTimer.current) clearInterval(saveTimer.current);
      document.removeEventListener("visibilitychange", onHide);
      saveResume();
    };
  }, [saveResume]);

  /* default subtitle once tracks ready */
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

  /* pip + fullscreen events */
  useEffect(() => {
    queueMicrotask(() =>
      setPipSupported(
        typeof document !== "undefined" && "pictureInPictureEnabled" in document
      )
    );
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const onPip = () => setIsPip(Boolean(document.pictureInPictureElement));
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs as EventListener);
    document.addEventListener("enterpictureinpicture", onPip);
    document.addEventListener("leavepictureinpicture", onPip);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs as EventListener);
      document.removeEventListener("enterpictureinpicture", onPip);
      document.removeEventListener("leavepictureinpicture", onPip);
    };
  }, []);

  /* close menu on outside click / Escape */
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu("none");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu("none");
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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

  const togglePip = useCallback(() => {
    const v = videoRef.current;
    if (!v || !pipSupported) return;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => {});
    } else {
      void v.requestPictureInPicture().catch(() => {});
    }
    wake();
  }, [pipSupported, wake]);

  /* keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return;
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowright":
          e.preventDefault();
          seekBy(5);
          break;
        case "arrowleft":
          e.preventDefault();
          seekBy(-5);
          break;
        case "arrowup":
          e.preventDefault();
          setVolume((vol) => Math.min(1, vol + 0.1));
          setMuted(false);
          wake();
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume((vol) => Math.max(0, vol - 0.1));
          wake();
          break;
        case "m":
          setMuted((m) => !m);
          wake();
          break;
        case "f":
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, toggleFullscreen, wake]);

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
    setLoaded(true);
  }, []);

  const onPointerMoveBar = useCallback((clientX: number) => {
    const bar = barRef.current;
    const v = videoRef.current;
    if (!bar || !v || !v.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    setHoverX(ratio);
    setHoverTime(ratio * v.duration);
    if (draggingRef.current) setTime(ratio * v.duration);
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

  const pickSpeed = useCallback(
    (r: number) => {
      const v = videoRef.current;
      setRate(r);
      if (v) v.playbackRate = r;
      setMenu("none");
      wake();
    },
    [wake]
  );

  const openMenu = useCallback(() => {
    setMenu((m) => (m === "settings" ? "none" : "settings"));
    wake();
  }, [wake]);

  const progress = duration > 0 ? (time / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const currentLevelHeight = level >= 0 && levels[level] ? levels[level] : null;

  const goEpisode = (next: boolean) => {
    if (!animeId || !ep || !onNavigateEpisode) return;
    const target = next ? ep + 1 : ep - 1;
    onNavigateEpisode(target);
  };

  const VolumeIcon = muted || volume === 0
    ? IconVolumeMuted
    : volume <= 0.5
      ? IconVolumeLow
      : IconVolumeHigh;

  const menuRowCls =
    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold transition hover:bg-white/5";
  const menuActive = "text-white";
  const menuInactive = "text-white/65";

  return (
    <div
      ref={wrapRef}
      className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.06]"
      onMouseMove={wake}
      onPointerDown={wake}
      onTouchStart={wake}
      onFocusCapture={wake}
      onBlurCapture={scheduleHide}
      onMouseLeave={() => {
        if (!playing) setControlsVisible(true);
      }}
    >
      <video
        ref={videoRef}
        key={videoUrl}
        className="h-full w-full object-contain"
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
        onSeeking={() => setWaiting(true)}
        onSeeked={() => setWaiting(false)}
        onEnded={() => {
          setControlsVisible(true);
          setPlaying(false);
        }}
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

      {/* ------------------------------ top bar ------------------------------ */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 bg-gradient-to-b from-black/75 via-black/30 to-transparent px-3 pb-12 pt-3 transition-opacity duration-300 sm:px-4 sm:pt-3.5 ${
          controlsVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="bg-gradient-btn flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-[0_4px_14px_rgba(124,92,255,0.45)]">
              <I size={14} className="text-white">
                <path d="M8 5.5v13l9-6.5z" />
              </I>
            </span>
            <span className="text-[15px] font-extrabold tracking-tight text-white">
              ANIME<span className="text-gradient">LK</span>
            </span>
            <span className="h-3.5 w-px shrink-0 bg-white/20" aria-hidden="true" />
            <span className="truncate text-[13px] font-semibold text-white/85">
              {animeTitle ?? ""}
            </span>
          </div>
          <div className="mt-1 pl-[38px] text-[11.5px] font-semibold text-white/55">
            {ep ? `Episode ${ep}` : ""}
            {title ? ` · ${title}` : ""}
          </div>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-0.5">
          {pipSupported && (
            <button
              onClick={togglePip}
              aria-label={isPip ? "Exit picture-in-picture" : "Picture in picture"}
              className={`${CTRL_BTN} ${isPip ? "text-primary" : ""}`}
            >
              <IconPip size={19} />
            </button>
          )}
          <button
            onClick={openMenu}
            aria-label="Player settings"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`${CTRL_BTN} ${menuOpen ? "text-primary" : ""}`}
          >
            <IconSettings size={19} />
          </button>
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className={CTRL_BTN}
          >
            {isFullscreen ? (
              <IconExitFullscreen size={19} />
            ) : (
              <IconFullscreen size={19} />
            )}
          </button>
        </div>
      </div>

      {/* ------------------------- center state overlay ------------------------- */}
      {!loaded && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="ak-spinner h-11 w-11 rounded-full border-[3px] border-white/15 border-t-primary" />
        </div>
      )}

      {waiting && loaded && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="ak-spinner h-11 w-11 rounded-full border-[3px] border-white/15 border-t-primary" />
        </div>
      )}

      {seekFlash && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span
            key={seekFlash.id}
            className="ak-seek-flash flex items-center justify-center rounded-2xl bg-black/55 px-5 py-4 ring-1 ring-white/10 backdrop-blur-md"
          >
            {seekFlash.dir === "back" ? (
              <IconBack10 size={36} className="text-white" />
            ) : (
              <IconFwd10 size={36} className="text-white" />
            )}
          </span>
        </div>
      )}

      {error ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#05060f]/95 p-6 text-center">
          <span className="bg-gradient-btn flex h-12 w-12 items-center justify-center rounded-2xl shadow-[0_10px_30px_rgba(124,92,255,0.4)]">
            <I size={22} className="text-white">
              <path d="M8 5.5v13l9-6.5z" />
            </I>
          </span>
          <p className="text-sm font-semibold text-red-300">{error}</p>
          <button
            onClick={() => {
              setError("");
              setRetryKey((k) => k + 1);
            }}
            className="flex h-10 items-center gap-2 rounded-full border border-white/15 px-5 text-[13px] font-bold text-white transition hover:border-primary hover:bg-primary/20"
          >
            <IconRetry size={16} />
            Retry
          </button>
        </div>
      ) : (
        !playing &&
        loaded &&
        duration > 0 && (
          <button
            onClick={togglePlay}
            aria-label="Play"
            className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm transition duration-200 hover:scale-105 hover:bg-primary/80 hover:ring-primary sm:h-[76px] sm:w-[76px]"
          >
            <I size={28} className="translate-x-[1px]">
              <path d="M8 5.5v13l9-6.5z" />
            </I>
          </button>
        )
      )}

      {/* ----------------------------- bottom bar ----------------------------- */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pb-2 pt-14 transition-opacity duration-300 sm:px-4 ${
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* timeline */}
        <div
          ref={barRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration)}
          aria-valuenow={Math.floor(time)}
          aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
          tabIndex={0}
          className="group/bar relative h-6 cursor-pointer touch-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              e.stopPropagation();
              seekBy(e.key === "ArrowLeft" ? -5 : 5);
            }
          }}
          onPointerDown={(e) => {
            draggingRef.current = true;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
            onPointerMoveBar(e.clientX);
            wake();
          }}
          onPointerMove={(e) => onPointerMoveBar(e.clientX)}
          onPointerUp={(e) => {
            draggingRef.current = false;
            setDragging(false);
            commitSeek(e.clientX);
            wake();
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/20 transition-all duration-150 group-hover/bar:h-[5px] group-focus-visible/bar:h-[5px]">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/25"
              style={{ width: `${bufferedPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-btn"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div
            className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(0,0,0,0.45)] ring-2 ring-white/0 transition-all duration-150 ${
              dragging || hoverTime !== null
                ? "scale-100 ring-white/30"
                : "scale-50 opacity-0 group-hover/bar:scale-100 group-hover/bar:opacity-100"
            }`}
            style={{ left: `${progress}%` }}
          />
          {hoverTime !== null && !dragging && (
            <div
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md bg-black/85 px-2 py-1 text-[11px] font-bold tabular-nums text-white ring-1 ring-white/10"
              style={{
                left: `${Math.min(Math.max(hoverX * 100, 3), 97)}%`,
              }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* control row */}
        <div className="mt-1.5 flex items-center gap-2">
          {/* left group */}
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className={`${PLAY_BTN} ${playing ? "text-white" : "text-primary"}`}
            >
              {playing ? <IconPause size={24} /> : <IconPlay size={24} />}
            </button>

            {hasPrev && (
              <button
                onClick={() => goEpisode(false)}
                aria-label="Previous episode"
                title="Previous episode"
                className={`${CTRL_BTN} hidden sm:inline-flex`}
              >
                <IconPrevEp size={20} />
              </button>
            )}
            {hasNext && (
              <button
                onClick={() => goEpisode(true)}
                aria-label="Next episode"
                title="Next episode"
                className={`${CTRL_BTN} hidden sm:inline-flex`}
              >
                <IconNextEp size={20} />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const v = videoRef.current;
                if (v) {
                  v.currentTime = Math.max(0, v.currentTime - 10);
                  wake();
                }
                flashSeek("back");
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Back 10 seconds"
              className={SEEK_BTN}
            >
              <IconBack10 size={26} />
              <SeekTooltip label="Back 10 seconds" align="start" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const v = videoRef.current;
                if (v) {
                  v.currentTime = Math.min(
                    Number.isFinite(v.duration) ? v.duration : v.currentTime + 10,
                    v.currentTime + 10
                  );
                  wake();
                }
                flashSeek("fwd");
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Forward 10 seconds"
              className={SEEK_BTN}
            >
              <IconFwd10 size={26} />
              <SeekTooltip label="Forward 10 seconds" />
            </button>

            <button
              onClick={() => setMuted((m) => !m)}
              aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
              className={`${CTRL_BTN} ${muted || volume === 0 ? "" : ""}`}
            >
              <VolumeIcon size={20} />
            </button>

            <div className="hidden items-center md:flex">
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
                className="ak-range w-20 cursor-pointer"
                style={{
                  background: `linear-gradient(90deg, #9b82ff ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.25) ${(muted ? 0 : volume) * 100}%)`,
                }}
              />
            </div>

            <span className="ml-1 shrink-0 text-[13px] font-semibold tabular-nums leading-none text-white/90">
              {formatTime(time)}
              {duration > 0 && (
                <span className="hidden text-white/45 sm:inline">
                  {" "}
                  / {formatTime(duration)}
                </span>
              )}
            </span>
          </div>

          <div className="flex-1" />

          {/* right group */}
          <div className="flex shrink-0 items-center gap-2">
            {subtitles.length > 0 && (
              <button
                onClick={openMenu}
                aria-label="Subtitles"
                className={`${CTRL_BTN} hidden sm:inline-flex ${activeSub !== null ? "text-primary" : ""}`}
              >
                <IconSubs size={20} />
              </button>
            )}
            <button
              onClick={openMenu}
              aria-label="Playback speed"
              className={`${CTRL_BTN} hidden gap-1 px-2.5 sm:inline-flex ${rate !== 1 ? "text-primary" : ""}`}
            >
              <IconSpeed size={20} />
              {rate !== 1 && (
                <span className="text-[12px] font-bold leading-none tabular-nums">
                  {rate}×
                </span>
              )}
            </button>
            {levels.length > 1 && (
              <button
                onClick={openMenu}
                aria-label="Quality"
                className={`${CTRL_BTN} hidden gap-1 px-2.5 sm:inline-flex`}
              >
                <IconQuality size={20} />
                <span className="text-[12px] font-bold leading-none tabular-nums">
                  {currentLevelHeight ? currentLevelHeight : "Auto"}
                </span>
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className={CTRL_BTN}
            >
              {isFullscreen ? (
                <IconExitFullscreen size={20} />
              ) : (
                <IconFullscreen size={20} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ----------------------------- settings menu ----------------------------- */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-[4.5rem] right-3 z-30 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#0b0d1a]/95 py-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:right-4"
          role="menu"
          aria-label="Playback settings"
        >
          <p className="px-3 pb-1 pt-1 text-[10.5px] font-bold uppercase tracking-widest text-muted">
            Playback speed
          </p>
          {SPEEDS.map((r) => (
            <button
              key={r}
              role="menuitemradio"
              aria-checked={rate === r}
              onClick={() => pickSpeed(r)}
              className={`${menuRowCls} ${rate === r ? menuActive : menuInactive}`}
            >
              <span>{r === 1 ? "Normal" : `${r}×`}</span>
              {rate === r && <IconCheck size={16} className="text-primary" />}
            </button>
          ))}

          {levels.length > 1 && (
            <>
              <div className="mx-3 my-1.5 h-px bg-white/[0.07]" />
              <p className="px-3 pb-1 text-[10.5px] font-bold uppercase tracking-widest text-muted">
                Quality
              </p>
              <button
                role="menuitemradio"
                aria-checked={level === -1}
                onClick={() => pickLevel(-1)}
                className={`${menuRowCls} ${level === -1 ? menuActive : menuInactive}`}
              >
                <span>Auto</span>
                {level === -1 && <IconCheck size={16} className="text-primary" />}
              </button>
              {levels.map((h, i) => (
                <button
                  key={`${h}-${i}`}
                  role="menuitemradio"
                  aria-checked={level === i}
                  onClick={() => pickLevel(i)}
                  className={`${menuRowCls} ${level === i ? menuActive : menuInactive}`}
                >
                  <span>{h}p</span>
                  {level === i && <IconCheck size={16} className="text-primary" />}
                </button>
              ))}
            </>
          )}

          {subtitles.length > 0 && (
            <>
              <div className="mx-3 my-1.5 h-px bg-white/[0.07]" />
              <p className="px-3 pb-1 text-[10.5px] font-bold uppercase tracking-widest text-muted">
                Subtitles
              </p>
              <button
                role="menuitemradio"
                aria-checked={activeSub === null}
                onClick={() => {
                  applySubtitle(null);
                  setMenu("none");
                  wake();
                }}
                className={`${menuRowCls} ${activeSub === null ? menuActive : menuInactive}`}
              >
                <span>Off</span>
                {activeSub === null && <IconCheck size={16} className="text-primary" />}
              </button>
              {subtitles.map((s, i) => (
                <button
                  key={i}
                  role="menuitemradio"
                  aria-checked={activeSub === i}
                  onClick={() => {
                    applySubtitle(i);
                    setMenu("none");
                    wake();
                  }}
                  className={`${menuRowCls} ${activeSub === i ? menuActive : menuInactive}`}
                >
                  <span>{s.label || `Track ${i + 1}`}</span>
                  {activeSub === i && <IconCheck size={16} className="text-primary" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
