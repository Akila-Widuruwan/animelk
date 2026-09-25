"use client";

import { useEffect, useState } from "react";
import { IconPlay } from "./Icons";

function ytEmbed(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{6,})/
  );
  if (!m) return null;
  return `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0`;
}

export default function TrailerButton({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const embed = ytEmbed(url);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition hover:border-primary hover:bg-primary/20"
      >
        <IconPlay className="h-4 w-4" />
        Watch Trailer
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            {embed ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
                <iframe
                  src={embed}
                  title="Trailer"
                  className="absolute inset-0 h-full w-full"
                  allowFullScreen
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-panel p-10 text-center">
                <p className="text-sm text-white/80">Trailer available at:</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block break-all text-sm font-semibold text-primary underline"
                >
                  {url}
                </a>
              </div>
            )}
            <button
              onClick={() => setOpen(false)}
              className="mx-auto mt-4 block rounded-full border border-white/15 px-5 py-2 text-[13px] font-semibold text-white transition hover:border-primary hover:bg-primary/20"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
