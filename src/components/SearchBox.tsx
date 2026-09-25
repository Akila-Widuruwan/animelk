"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Anime } from "@/lib/anime";
import { year } from "@/lib/anime";
import { IconSearch } from "./Icons";

export default function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Anime[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
        setError("");
      } catch {
        if (!ctrl.signal.aborted) setError("Search failed. Please try again.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [q]);

  const submit = () => {
    const query = q.trim();
    if (!query) return;
    abortRef.current?.abort();
    setOpen(false);
    onNavigate?.();
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const meta = (a: Anime) =>
    [year(a), a.episodes ? `${a.episodes} Episodes` : a.format]
      .filter(Boolean)
      .join(" • ");

  return (
    <div ref={wrapRef} className="relative w-full">
      <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-white/60" />
      <input
        type="text"
        value={q}
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          setOpen(true);
          if (v.trim().length < 2) {
            abortRef.current?.abort();
            setResults(null);
            setLoading(false);
            setError("");
          }
        }}
        onFocus={() => {
          if (q.trim().length >= 2) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search anime, movies..."
        aria-label="Search anime"
        className="h-10 w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 text-[13px] text-white outline-none backdrop-blur transition-all duration-300 placeholder:text-muted focus:border-primary/60 focus:bg-panel/80 md:w-[200px] md:focus:w-[280px]"
      />

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 min-w-[280px] overflow-hidden rounded-xl border border-white/10 bg-panel/95 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl md:right-0 md:left-auto md:w-[320px]">
          {loading && (
            <div className="space-y-3 p-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-14 w-10 shrink-0 animate-pulse rounded-md bg-white/[0.07]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/[0.07]" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <p className="px-4 py-6 text-center text-[13px] text-red-300">{error}</p>
          )}

          {!loading && !error && results !== null && results.length === 0 && (
            <p className="px-4 py-6 text-center text-[13px] text-muted">
              No anime found for “{q.trim()}”
            </p>
          )}

          {!loading && !error && results !== null && results.length > 0 && (
            <>
              <div className="max-h-[380px] overflow-y-auto p-2">
                {results.map((a) => (
                  <Link
                    key={a.id}
                    href={`/anime/${a.id}`}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/5"
                  >
                    <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-panel-2 ring-1 ring-white/[0.06]">
                      {a.coverImage && (
                        <Image
                          src={a.coverImage}
                          alt={a.title}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-white">
                        {a.title}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted">
                        {meta(a)}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
              <button
                onClick={submit}
                className="block w-full border-t border-white/[0.06] px-4 py-3 text-left text-[12.5px] font-bold text-violet-2 transition hover:bg-white/5"
              >
                View all results →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
