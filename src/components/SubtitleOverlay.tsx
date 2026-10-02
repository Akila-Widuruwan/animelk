"use client";

import { useEffect, useState } from "react";
import type { PlayerLayout } from "@/lib/usePlayerLayout";

interface SubCue {
  start: number;
  end: number;
  text: string;
}

function parseTiming(line: string): [number, number] | null {
  const m = line.match(
    /(?:(\d{2,}):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d{2,}):)?(\d{2}):(\d{2})[,.](\d{3})/
  );
  if (!m) return null;
  const sec = (h: string | undefined, mm: string, s: string, ms: string) =>
    (h ? Number(h) * 3600 : 0) +
    Number(mm) * 60 +
    Number(s) +
    Number(ms) / 1000;
  return [sec(m[1], m[2], m[3], m[4]), sec(m[5], m[6], m[7], m[8])];
}

function parseSubtitleText(raw: string): SubCue[] {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const isVtt = /^WEBVTT/i.test(lines[0] ?? "");
  const cues: SubCue[] = [];
  let pending: [number, number] | null = null;
  let textLines: string[] = [];

  const flush = () => {
    if (pending) {
      const text = textLines.join("\n").trim();
      if (text) cues.push({ start: pending[0], end: pending[1], text });
    }
    pending = null;
    textLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (pending && !line) {
      flush();
      continue;
    }
    const timing = parseTiming(line);
    if (timing) {
      flush();
      pending = timing;
      continue;
    }
    if (!pending) continue;
    if (isVtt && /^(NOTE|STYLE|REGION)/i.test(line)) continue;
    if (!isVtt && /^\d+$/.test(line)) continue;
    textLines.push(rawLine);
  }
  flush();
  return cues;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, "\u00a0");
}

function renderInline(text: string, keyPrefix: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  const re = /<(\/?)(b|i|u)>/gi;
  let last = 0;
  let bold = false;
  let italic = false;
  let underline = false;
  let m: RegExpExecArray | null;

  const push = (end: number) => {
    const chunk = text.slice(last, end);
    if (!chunk) return;
    const cls = `${bold ? "font-bold " : ""}${italic ? "italic " : ""}${
      underline ? "underline" : ""
    }`.trim();
    nodes.push(
      <span key={`${keyPrefix}-${nodes.length}`} className={cls || undefined}>
        {chunk}
      </span>
    );
  };

  while ((m = re.exec(text))) {
    push(m.index);
    const closing = Boolean(m[1]);
    const tag = m[2].toLowerCase();
    if (tag === "b") bold = !closing;
    else if (tag === "i") italic = !closing;
    else if (tag === "u") underline = !closing;
    last = re.lastIndex;
  }
  push(text.length);
  return nodes;
}

function cueToJsx(text: string, keyPrefix: string): React.ReactNode {
  const cleaned = text
    .replace(/<(\/)?(c|v)(\.[^>\s]*)?([^>]*)>/gi, "")
    .replace(/<\d{2}:\d{2}:\d{2}[,.]\d{3}>/g, "")
    .replace(/<br\s*\/?>/gi, "\n");
  const lines = decodeEntities(cleaned).split("\n");
  return lines.map((ln, i) => (
    <span key={`${keyPrefix}-${i}`} className="block">
      {renderInline(ln, `${keyPrefix}-${i}`)}
    </span>
  ));
}

export default function SubtitleOverlay({
  url,
  time,
  layout,
  controlsVisible,
}: {
  url: string | null;
  time: number;
  layout: PlayerLayout | null;
  controlsVisible: boolean;
}) {
  const [loaded, setLoaded] = useState<{ url: string; cues: SubCue[] } | null>(
    null
  );

  useEffect(() => {
    let ignore = false;
    if (!url) return;
    fetch(url)
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (ignore || !text) return;
        setLoaded({ url, cues: parseSubtitleText(text) });
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [url]);

  if (!url || !layout || !loaded || loaded.url !== url || loaded.cues.length === 0) {
    return null;
  }

  const active = loaded.cues.filter((c) => time >= c.start && time <= c.end);
  if (active.length === 0) return null;

  /* ---- player-relative, letterbox-aware, controls-aware positioning ---- */

  const GAP_ABOVE_CONTROLS = 14;
  const SAFE_RATIO_VISIBLE = 0.2;
  const SAFE_RATIO_HIDDEN = 0.12;
  const MAX_RATIO = 0.55;

  const letterboxBottom =
    layout.playerHeight - (layout.videoTop + layout.videoHeight);
  const aboveControls = layout.controlsHeight + GAP_ABOVE_CONTROLS;
  const targetBottom =
    letterboxBottom +
    layout.videoHeight * (controlsVisible ? SAFE_RATIO_VISIBLE : SAFE_RATIO_HIDDEN);

  let bottom = controlsVisible
    ? Math.max(aboveControls, targetBottom)
    : targetBottom;
  bottom = Math.min(bottom, letterboxBottom + layout.videoHeight * MAX_RATIO);

  const fontSize = Math.round(
    Math.min(32, Math.max(14, layout.videoHeight * 0.046))
  );
  const maxWidth = Math.min(
    layout.videoWidth * 0.96,
    layout.playerWidth * 0.92
  );

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center gap-1 px-4 text-center transition-[bottom] duration-200 ease-out"
      style={{ bottom }}
    >
      {active.map((c, i) => (
        <span
          key={`${c.start}-${i}`}
          dir="auto"
          className="ak-sub block font-semibold leading-[1.4] text-white"
          style={{ fontSize, maxWidth }}
        >
          {cueToJsx(c.text, `${c.start}-${i}`)}
        </span>
      ))}
    </div>
  );
}
