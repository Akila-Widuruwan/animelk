"use client";

import { createElement, useCallback, useEffect, useRef, useState } from "react";
import type { SubtitleTrack } from "@/lib/db";
import type { VideoSource } from "@/lib/stream";

const ELEMENT_SCRIPT = "/vendor/movi-element.slim.js";
const WASM_URL = "/vendor/movi.wasm";

interface Props {
  videoUrl: string;
  sources?: VideoSource[];
  poster?: string | null;
  title?: string;
  subtitles?: SubtitleTrack[];
}

export default function MkvPlayer({
  videoUrl,
  sources,
  poster,
  title,
  subtitles = [],
}: Props) {
  const [ready, setReady] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.customElements.get("movi-player"))
  );
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    if (window.customElements.get("movi-player")) {
      queueMicrotask(() => {
        if (aliveRef.current) setReady(true);
      });
      return;
    }
    let el = document.querySelector<HTMLScriptElement>(
      `script[data-movi-player]`
    );
    if (!el) {
      el = document.createElement("script");
      el.src = ELEMENT_SCRIPT;
      el.type = "module";
      el.async = true;
      el.dataset.moviPlayer = "";
      document.head.appendChild(el);
    }
    const onLoad = () => {
      if (aliveRef.current) setReady(true);
    };
    el.addEventListener("load", onLoad);
    return () => {
      aliveRef.current = false;
      el.removeEventListener("load", onLoad);
    };
  }, []);

  const setPlayerRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    el.setAttribute("controls", "");
    el.setAttribute("autoplay", "");
    el.setAttribute("thumb", "");
    el.setAttribute("renderer", "canvas");
  }, []);

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  const multiSource = Boolean(sources && sources.length > 1);

  return createElement(
    "movi-player",
    {
      ref: setPlayerRef,
      src: multiSource ? undefined : videoUrl,
      poster: poster || undefined,
      title,
      wasmurl: WASM_URL,
      playsinline: "",
      objectfit: "control",
      fastseek: "",
      stablevolume: "",
      fallback: "native",
      className: "h-full w-full",
      style: { display: "block", width: "100%", height: "100%" },
    },
    ...(multiSource
      ? (sources ?? []).map((s, i) =>
          createElement("source", {
            key: s.url,
            src: s.url,
            ...(s.height != null ? { "data-height": s.height } : {}),
            ...(i === 0 ? { "data-default": "" } : {}),
          })
        )
      : []),
    ...subtitles.map((s, i) =>
      createElement("track", {
        key: `${s.url}-${i}`,
        src: s.url,
        kind: "subtitles",
        srcLang: s.lang,
        label: s.label,
        ...(s.default ? { "data-default": "" } : {}),
      })
    )
  );
}
