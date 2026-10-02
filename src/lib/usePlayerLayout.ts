"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

export interface PlayerLayout {
  playerWidth: number;
  playerHeight: number;
  videoTop: number;
  videoLeft: number;
  videoWidth: number;
  videoHeight: number;
  controlsHeight: number;
}

/**
 * Measures the real, displayed geometry of the player:
 *  - the player element itself (also the fullscreen element when active)
 *  - the actual video image rectangle (accounts for object-fit: contain
 *    letterboxing using the media's natural dimensions)
 *  - the height of the visible controls bar
 *
 * Recalculates on element resize (ResizeObserver), window resize,
 * orientation change and fullscreen enter/exit.
 */
export function usePlayerLayout(
  wrapRef: RefObject<HTMLDivElement | null>,
  controlsRef: RefObject<HTMLDivElement | null>,
  videoRef: RefObject<HTMLVideoElement | null>
): PlayerLayout | null {
  const [layout, setLayout] = useState<PlayerLayout | null>(null);
  const videoSizeRef = useRef<{ w: number; h: number } | null>(null);

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap) return;
    const pr = wrap.getBoundingClientRect();
    if (pr.width <= 0 || pr.height <= 0) return;

    const controlsHeight = (() => {
      const bar = controlsRef.current?.getBoundingClientRect();
      return bar ? Math.max(0, pr.bottom - bar.top) : 0;
    })();

    let videoRect = {
      top: 0,
      left: 0,
      width: pr.width,
      height: pr.height,
    };
    const natural = videoSizeRef.current ?? {
      w: video?.videoWidth ?? 0,
      h: video?.videoHeight ?? 0,
    };
    if (natural.w > 0 && natural.h > 0) {
      const scale = Math.min(pr.width / natural.w, pr.height / natural.h);
      videoRect = {
        width: natural.w * scale,
        height: natural.h * scale,
        left: (pr.width - natural.w * scale) / 2,
        top: (pr.height - natural.h * scale) / 2,
      };
    }

    const next: PlayerLayout = {
      playerWidth: pr.width,
      playerHeight: pr.height,
      videoTop: videoRect.top,
      videoLeft: videoRect.left,
      videoWidth: videoRect.width,
      videoHeight: videoRect.height,
      controlsHeight,
    };

    setLayout((prev) => {
      if (
        prev &&
        Math.abs(prev.playerWidth - next.playerWidth) < 0.5 &&
        Math.abs(prev.playerHeight - next.playerHeight) < 0.5 &&
        Math.abs(prev.videoTop - next.videoTop) < 0.5 &&
        Math.abs(prev.videoLeft - next.videoLeft) < 0.5 &&
        Math.abs(prev.videoWidth - next.videoWidth) < 0.5 &&
        Math.abs(prev.videoHeight - next.videoHeight) < 0.5 &&
        Math.abs(prev.controlsHeight - next.controlsHeight) < 0.5
      ) {
        return prev;
      }
      return next;
    });
  }, [wrapRef, controlsRef, videoRef]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const controls = controlsRef.current;
    const video = videoRef.current;
    if (!wrap || !video) return;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(wrap);
      if (controls) ro.observe(controls);
    }

    const onVideoMeta = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        videoSizeRef.current = { w: video.videoWidth, h: video.videoHeight };
      }
      measure();
    };
    const onFullscreen = () => measure();
    const onResize = () => measure();
    const onOrient = () => {
      window.setTimeout(() => measure(), 150);
    };

    video.addEventListener("loadedmetadata", onVideoMeta);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener(
      "webkitfullscreenchange",
      onFullscreen as EventListener
    );
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrient);

    onVideoMeta();
    measure();

    return () => {
      ro?.disconnect();
      video.removeEventListener("loadedmetadata", onVideoMeta);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener(
        "webkitfullscreenchange",
        onFullscreen as EventListener
      );
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrient);
    };
  }, [measure, wrapRef, controlsRef, videoRef]);

  return layout;
}
