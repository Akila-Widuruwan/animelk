"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { IconClose, IconSearch } from "@/components/Icons";
import type { CatalogAnime } from "@/lib/anime-provider";
import {
  catalogFormatLabel,
  catalogStatusLabel,
  fetchRequestsForExternalIds,
  formatCount,
  isMissingSchema,
  type AnimeRequest,
} from "@/lib/requests";

interface Props {
  onSelect: (anime: CatalogAnime, existing: AnimeRequest[]) => void;
  selectedId?: number | null;
}

interface SearchPayload {
  key: string;
  results: CatalogAnime[];
  existing: Record<number, AnimeRequest[]>;
}

const DEBOUNCE_MS = 350;

/**
 * Realtime anime search backed by the site's catalogue provider.
 *
 * Debounced, abortable, and cached per query so typing never floods the API.
 * Each hit is cross-checked against the internal request database so results can
 * say "Already requested • 142 requests" or "Not requested yet" up front.
 */
export default function AnimeSearch({ onSelect, selectedId = null }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, SearchPayload>>(new Map());

  const [q, setQ] = useState("");
  const [payload, setPayload] = useState<SearchPayload | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [missingSchema, setMissingSchema] = useState(false);

  const key = q.trim().toLowerCase();
  const hasQuery = key.length >= 2;
  const current = payload && payload.key === key ? payload : null;
  const currentError = error && error.key === key ? error.message : "";
  const results = current?.results ?? [];
  const showPanel = open && hasQuery;
  // Derived, so nothing has to be written to state while typing.
  const loading = showPanel && !current && !currentError;

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
    if (timerRef.current) clearTimeout(timerRef.current);
    if (key.length < 2) {
      abortRef.current?.abort();
      return;
    }

    const cached = cacheRef.current.get(key);
    if (cached) {
      const t = setTimeout(() => {
        setPayload(cached);
        setError(null);
        setActive(-1);
      }, 0);
      return () => clearTimeout(t);
    }

    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch(`/api/anime-search?q=${encodeURIComponent(key)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as {
          ok?: boolean;
          results?: CatalogAnime[];
          error?: string;
        };
        if (!res.ok || data.ok === false) {
          setError({
            key,
            message:
              data.error ?? "Something went wrong while searching. Please try again.",
          });
          return;
        }

        const found = data.results ?? [];
        let existing: Record<number, AnimeRequest[]> = {};

        if (found.length > 0) {
          try {
            const rows = await fetchRequestsForExternalIds(
              found.map((r) => r.externalId)
            );
            existing = rows.reduce<Record<number, AnimeRequest[]>>((acc, row) => {
              const id = Number(row.external_id);
              (acc[id] ??= []).push(row);
              return acc;
            }, {});
          } catch (e) {
            // The request database may not be migrated yet — search still works.
            if (isMissingSchema(e)) setMissingSchema(true);
          }
        }

        const next: SearchPayload = { key, results: found, existing };
        cacheRef.current.set(key, next);
        setPayload(next);
        setError(null);
        setActive(-1);
      } catch {
        if (!ctrl.signal.aborted) {
          setError({
            key,
            message: "Something went wrong while searching. Please try again.",
          });
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [key]);

  const choose = (anime: CatalogAnime) => {
    setOpen(false);
    setActive(-1);
    onSelect(anime, current?.existing[anime.externalId] ?? []);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!showPanel || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[Math.min(Math.max(active, 0), results.length - 1)];
      if (pick) choose(pick);
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <IconSearch className="pointer-events-none absolute left-4 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-white/55" />
      <input
        type="text"
        value={q}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="request-search-results"
        aria-autocomplete="list"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (hasQuery) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search anime to request..."
        className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-12 pr-12 text-[15px] text-white outline-none backdrop-blur transition duration-300 placeholder:text-muted focus:border-primary/60 focus:bg-panel/70 focus:shadow-[0_0_0_4px_rgba(124,92,255,0.12)] sm:h-16 sm:text-base"
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            setOpen(false);
          }}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <IconClose className="h-4 w-4" />
        </button>
      )}
      {loading && (
        <span className="pointer-events-none absolute right-12 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      )}

      {showPanel && (
        <div
          id="request-search-results"
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-panel/95 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl [animation:ak-fade-in_0.15s_ease]"
        >
          {loading && (
            <div className="space-y-3 p-3">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-16 w-11 shrink-0 animate-pulse rounded-lg bg-white/[0.07]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-white/[0.07]" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-white/[0.05]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && currentError && (
            <p className="px-5 py-8 text-center text-[13.5px] text-red-300">
              {currentError}
            </p>
          )}

          {!loading && !currentError && current && results.length === 0 && (
            <p className="px-5 py-8 text-center text-[13.5px] text-muted">
              No anime found.
            </p>
          )}

          {!loading && !currentError && results.length > 0 && (
            <div className="max-h-[min(60vh,420px)] overflow-y-auto scroll-thin p-2">
              {results.map((a, i) => {
                const rows = current?.existing[a.externalId] ?? [];
                const best = rows.length
                  ? rows.reduce((x, y) => (y.request_count > x.request_count ? y : x))
                  : null;
                const isCurrent = selectedId === a.externalId;
                return (
                  <button
                    key={`${a.source}-${a.externalId}`}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(a)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                      i === active ? "bg-white/[0.07]" : "hover:bg-white/5"
                    } ${isCurrent ? "ring-1 ring-primary/50" : ""}`}
                  >
                    <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-panel-2 ring-1 ring-white/[0.06]">
                      {a.cover && (
                        <Image
                          src={a.cover}
                          alt={a.title}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold text-white">
                        {a.title}
                      </span>
                      {a.titleNative && a.titleNative !== a.title && (
                        <span className="block truncate text-[11.5px] text-muted">
                          {a.titleNative}
                        </span>
                      )}
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
                        <span>
                          {[
                            a.year ? String(a.year) : null,
                            catalogFormatLabel(a.format) || null,
                            a.episodes ? `${a.episodes} Episodes` : null,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                        {catalogStatusLabel(a.status) && (
                          <span className="text-white/40">
                            {catalogStatusLabel(a.status)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {best ? (
                        <>
                          <span className="block text-[11px] font-bold text-amber-300">
                            🔥 {formatCount(best.request_count)} requests
                          </span>
                          <span className="mt-0.5 block text-[10.5px] font-semibold text-emerald-300">
                            ✓ Already requested
                          </span>
                        </>
                      ) : (
                        <span className="block text-[10.5px] font-semibold text-muted">
                          Not requested yet
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {missingSchema && (
            <p className="border-t border-white/[0.06] px-4 py-2.5 text-[11.5px] text-amber-300/90">
              Request tracking will be available once the request database is set up.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
