"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { streamUrl } from "@/lib/stream";
import type { SubtitleTrack } from "@/lib/db";

interface Props {
  videoUrl: string;
  subtitles?: SubtitleTrack[];
}

export default function ExternalPlayerButtons({
  videoUrl,
  subtitles = [],
}: Props) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
  }, []);

  if (!origin) return null;

  const proxied = streamUrl(videoUrl);
  const absolute = proxied.startsWith("http")
    ? proxied
    : `${origin}${proxied}`;
  const encoded = encodeURIComponent(absolute);

  const sub = subtitles.find((s) => s.default) ?? subtitles[0];
  const subUrl = sub?.url
    ? sub.url.startsWith("http")
      ? sub.url
      : `${origin}${sub.url}`
    : null;

  const extra = [
    `S.title=${encodeURIComponent("AniLanka")}`,
    ...(subUrl
      ? [`S.subtitles_location=${encodeURIComponent(subUrl)}`]
      : []),
  ].join(";");

  const vlcHref = `intent:${absolute}#Intent;type=video/*;package=org.videolan.vlc;${extra};end`;

  const players = [
    {
      label: "VLC",
      icon: "/logos/vlc.png",
      href: vlcHref,
    },
    {
      label: "MX Player",
      icon: "/logos/mx.png",
      href: `intent:${absolute}#Intent;type=video/*;package=com.mxtech.videoplayer.ad;end`,
    },
  ];

  const copySub = async () => {
    if (!subUrl) return;
    try {
      await navigator.clipboard.writeText(subUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {players.map((p) => (
        <a
          key={p.label}
          href={p.href}
          className="flex h-11 items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-4 pr-5 text-[13.5px] font-bold text-white transition duration-200 hover:border-violet-2/70 hover:bg-violet-2/15"
        >
          <Image
            src={p.icon}
            alt={`${p.label} logo`}
            width={22}
            height={22}
            className="h-[22px] w-[22px] rounded-[6px] object-cover"
          />
          {p.label}
        </a>
      ))}
      <a
        href={`vlc-x-callback://x-callback-url/stream?url=${encoded}`}
        className="flex h-11 items-center rounded-full border border-white/15 bg-white/5 px-5 text-[13.5px] font-bold text-white transition duration-200 hover:border-violet-2/70 hover:bg-violet-2/15"
      >
        VLC (iOS)
      </a>
      <a
        href={`intent:${absolute}#Intent;type=video/*;${extra};end`}
        className="flex h-11 items-center rounded-full border border-white/15 bg-white/5 px-5 text-[13.5px] font-bold text-white transition duration-200 hover:border-violet-2/70 hover:bg-violet-2/15"
      >
        Other app
      </a>
      {subUrl && (
        <button
          onClick={copySub}
          className="flex h-11 items-center rounded-full border border-white/15 bg-white/5 px-5 text-[13.5px] font-bold text-white transition duration-200 hover:border-violet-2/70 hover:bg-violet-2/15"
        >
          {copied ? "Copied" : "Copy subtitle link"}
        </button>
      )}
    </div>
  );
}
