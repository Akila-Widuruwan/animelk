"use client";

import Image from "next/image";
import { IconCheck, IconClose, IconPlus } from "@/components/Icons";
import type { CatalogAnime } from "@/lib/anime-provider";
import {
  REQUEST_TYPES,
  catalogFormatLabel,
  catalogStatusLabel,
  formatCount,
  statusMeta,
  type AnimeRequest,
  type RequestType,
} from "@/lib/requests";

interface Props {
  anime: CatalogAnime;
  requestType: RequestType;
  onRequestType: (type: RequestType) => void;
  season: number;
  onSeason: (season: number) => void;
  message: string;
  onMessage: (message: string) => void;
  /** The existing request for this selection, if it has already been asked for. */
  existing: AnimeRequest | null;
  supported: boolean;
  busy: boolean;
  error: string;
  onSubmit: () => void;
  onSupport: () => void;
  onClear: () => void;
}

export default function RequestConfirmCard({
  anime,
  requestType,
  onRequestType,
  season,
  onSeason,
  message,
  onMessage,
  existing,
  supported,
  busy,
  error,
  onSubmit,
  onSupport,
  onClear,
}: Props) {
  const meta = [
    anime.year ? String(anime.year) : null,
    catalogFormatLabel(anime.format) || null,
    catalogStatusLabel(anime.status) || null,
  ]
    .filter(Boolean)
    .join(" • ");

  const alreadyRequested = Boolean(existing);
  const seasonLabel = requestType === "NEW_SEASON" ? `Season ${season}` : null;

  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-panel/90 to-panel/60 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-sm [animation:fadeInUp_0.45s_ease]">
      <div className="flex flex-col gap-4 border-b border-white/[0.06] p-5 sm:flex-row sm:items-center sm:gap-5">
        <span className="relative mx-auto h-44 w-[120px] shrink-0 overflow-hidden rounded-xl bg-panel-2 ring-1 ring-white/[0.08] sm:mx-0 sm:h-40 sm:w-[108px]">
          {anime.cover ? (
            <Image
              src={anime.cover}
              alt={anime.title}
              fill
              sizes="120px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[11px] text-muted">
              No image
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-400/25">
            <IconCheck className="h-3 w-3" /> Anime selected
          </span>
          <h3 className="mt-2 text-[19px] font-extrabold leading-tight text-white sm:text-[21px]">
            {anime.title}
          </h3>
          {seasonLabel && (
            <p className="mt-0.5 text-[13.5px] font-bold text-violet-2">{seasonLabel}</p>
          )}
          {anime.titleNative && anime.titleNative !== anime.title && (
            <p className="mt-0.5 truncate text-[12.5px] text-muted">{anime.titleNative}</p>
          )}
          <p className="mt-1.5 text-[12.5px] font-semibold text-white/70">{meta}</p>
        </div>

        <button
          type="button"
          onClick={onClear}
          aria-label="Remove selection"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-primary/50 hover:text-white sm:static"
        >
          <IconClose className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-5 p-5">
        {alreadyRequested && existing && (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] font-bold text-amber-200">Already requested</p>
              <p className="text-[12.5px] text-amber-200/70">
                {formatCount(existing.request_count)} people have requested this anime.
              </p>
            </div>
            <span
              className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1 ${
                statusMeta(existing.status).className
              }`}
            >
              {statusMeta(existing.status).label}
            </span>
          </div>
        )}

        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted">
            Request type
          </p>
          <div className="flex flex-wrap gap-2">
            {REQUEST_TYPES.map((t) => {
              const active = t.id === requestType;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onRequestType(t.id)}
                  title={t.hint}
                  aria-pressed={active}
                  className={`rounded-full px-3.5 py-2 text-[12.5px] font-bold transition active:scale-[0.97] ${
                    active
                      ? "bg-gradient-btn text-white shadow-[0_6px_18px_rgba(124,92,255,0.35)]"
                      : "border border-white/10 bg-white/[0.04] text-white/70 hover:border-primary/50 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {requestType === "NEW_SEASON" && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <label className="block text-[12px] font-bold uppercase tracking-wide text-muted">
              Which season?
            </label>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSeason(Math.max(1, season - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white transition hover:border-primary/50"
                aria-label="Previous season"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={50}
                value={season}
                onChange={(e) =>
                  onSeason(Math.min(50, Math.max(1, Number(e.target.value) || 1)))
                }
                className="h-9 w-20 rounded-lg border border-white/10 bg-ink px-3 text-center text-[13px] font-bold text-white outline-none focus:border-primary/60"
                aria-label="Season number"
              />
              <button
                type="button"
                onClick={() => onSeason(Math.min(50, season + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white transition hover:border-primary/50"
                aria-label="Next season"
              >
                +
              </button>
              <span className="text-[12.5px] font-bold text-violet-2">
                Season {season}
              </span>
            </div>
            <p className="mt-2 text-[11.5px] text-muted">
              Each season is tracked as its own request, so Season 1, 2 and 3 never
              share the same count.
            </p>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="request-message"
              className="text-[12px] font-bold uppercase tracking-wide text-muted"
            >
              Anything else we should know? (Optional)
            </label>
            <span className="text-[11px] text-muted">{message.length}/300</span>
          </div>
          <textarea
            id="request-message"
            rows={3}
            maxLength={300}
            value={message}
            onChange={(e) => onMessage(e.target.value.slice(0, 300))}
            placeholder="Example: Please add Season 3 with Sinhala subtitles."
            className="w-full resize-none rounded-xl border border-white/10 bg-ink/70 px-3.5 py-3 text-[13px] text-white outline-none transition placeholder:text-muted focus:border-primary/60"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-[12.5px] text-red-300">
            {error}
          </p>
        )}

        {alreadyRequested ? (
          supported ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3.5 text-[13.5px] font-bold text-emerald-300">
              <IconCheck className="h-4 w-4" /> You supported this request
            </div>
          ) : (
            <button
              type="button"
              onClick={onSupport}
              disabled={busy}
              className="bg-gradient-btn flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[14px] font-bold text-white shadow-[0_10px_28px_rgba(124,92,255,0.35)] transition hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
            >
              <IconPlus className="h-4 w-4" />
              {busy ? "Submitting request…" : "Support Request"}
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="bg-gradient-btn flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[14px] font-bold text-white shadow-[0_10px_28px_rgba(124,92,255,0.35)] transition hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "Submitting request…" : "Submit Request"}
          </button>
        )}
      </div>
    </div>
  );
}
