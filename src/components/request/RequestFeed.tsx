"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { IconCheck, IconPlay, IconPlus } from "@/components/Icons";
import { supabaseBrowser } from "@/lib/supabase-browser";
import RequestStatusBadge from "./RequestStatusBadge";
import {
  PAGE_SIZE,
  REQUEST_SORTS,
  REQUEST_STATUS_ORDER,
  catalogFormatLabel,
  fetchRequestFeed,
  formatCount,
  friendlyError,
  isMissingSchema,
  relativeDate,
  supportAnimeRequest,
  type AnimeRequest,
  type RequestSort,
  type RequestStatus,
} from "@/lib/requests";

const HEADINGS: Record<RequestSort, { title: string; subtitle: string }> = {
  MOST_REQUESTED: {
    title: "Most Requested Anime",
    subtitle: "See what the community wants us to add next.",
  },
  RECENTLY_REQUESTED: {
    title: "Recently Requested",
    subtitle: "The newest requests from the community.",
  },
  RECENTLY_ADDED: {
    title: "Recently Added",
    subtitle: "Requests we've already delivered.",
  },
};

interface Props {
  /** Bump to force a refresh (e.g. right after the visitor submits). */
  reloadKey: number;
  supportedIds: Set<number>;
  onSupported: (request: AnimeRequest) => void;
}

export default function RequestFeed({ reloadKey, supportedIds, onSupported }: Props) {
  const [sort, setSort] = useState<RequestSort>("MOST_REQUESTED");
  const [status, setStatus] = useState<RequestStatus | "ALL">("ALL");
  const [items, setItems] = useState<AnimeRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const from = reset ? 0 : items.length;
        const { rows, total: count } = await fetchRequestFeed({
          sort,
          status,
          from,
          to: from + PAGE_SIZE - 1,
        });
        setItems((prev) => {
          if (reset) return rows;
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...rows.filter((r) => !seen.has(r.id))];
        });
        setTotal(count);
        setError("");
        setMissing(false);
      } catch (e) {
        if (isMissingSchema(e)) {
          setMissing(true);
          setItems([]);
          setTotal(0);
        } else {
          setError(friendlyError(e, "We couldn't load requests right now. Please try again."));
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [sort, status, items.length]
  );

  // Reload from the first page whenever the sort/filter changes or the page
  // asks for a refresh after a submission. The work starts after a microtask so
  // no state is written synchronously while the effect runs.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await load(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, status, reloadKey]);

  // Realtime: counts update live; a brand-new request refreshes the ranking.
  useEffect(() => {
    if (missing) return;
    const sb = supabaseBrowser();
    const channel = sb
      .channel("animelk-requests-feed")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "anime_requests" },
        (payload) => {
          const row = payload.new as AnimeRequest;
          if (!row?.id) return;
          setItems((prev) =>
            prev.map((r) =>
              r.id === row.id
                ? {
                    ...r,
                    request_count: row.request_count ?? r.request_count,
                    status: row.status ?? r.status,
                    added_anime_id: row.added_anime_id ?? r.added_anime_id,
                    last_requested_at: row.last_requested_at ?? r.last_requested_at,
                  }
                : r
            )
          );
          setFlash(row.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "anime_requests" },
        () => {
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(() => void load(true), 1200);
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  const support = async (request: AnimeRequest) => {
    if (busyId !== null || supportedIds.has(request.id)) return;
    setBusyId(request.id);
    try {
      const result = await supportAnimeRequest(request.id);
      setItems((prev) =>
        prev.map((r) =>
          r.id === request.id
            ? { ...r, request_count: result.request.request_count }
            : r
        )
      );
      setFlash(request.id);
      onSupported(result.request);
    } catch (e) {
      setError(friendlyError(e, "We couldn't add your support. Please try again."));
    } finally {
      setBusyId(null);
    }
  };

  const heading = HEADINGS[sort];
  const visible = total > items.length;

  return (
    <section id="most-requested" className="mt-14 scroll-mt-24 sm:mt-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">
            {heading.title}
          </h2>
          <p className="mt-1 text-[13px] text-muted">{heading.subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {REQUEST_SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSort(s.id)}
              aria-pressed={sort === s.id}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                sort === s.id
                  ? "bg-gradient-btn text-white"
                  : "border border-white/10 bg-white/[0.03] text-white/65 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["ALL", ...REQUEST_STATUS_ORDER] as const).map((s) => {
          const label =
            s === "ALL"
              ? "All"
              : s === "REQUESTED"
                ? "Requested"
                : s === "PLANNED"
                  ? "Planned"
                  : s === "ADDED"
                    ? "Added"
                    : s === "UNDER_REVIEW"
                      ? "Under Review"
                      : s === "PROCESSING"
                        ? "Processing"
                        : "Rejected";
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition ${
                status === s
                  ? "bg-white/[0.12] text-white ring-1 ring-white/20"
                  : "text-muted hover:text-white"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: PAGE_SIZE }, (_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-white/[0.06]" />
              <div className="mt-2.5 h-3.5 w-4/5 animate-pulse rounded bg-white/[0.06]" />
              <div className="mt-1.5 h-3 w-2/5 animate-pulse rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mt-6 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-6 py-10 text-center">
          <p className="text-[13.5px] text-red-200">{error}</p>
          <button
            type="button"
            onClick={() => void load(true)}
            className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-[12.5px] font-bold text-white transition hover:border-primary/50"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && missing && (
        <div className="mt-6 rounded-xl border border-white/10 bg-panel/40 px-6 py-12 text-center">
          <p className="text-[14px] font-bold text-white">No requests yet.</p>
          <p className="mt-1.5 text-[13px] text-muted">
            Be the first person to request an anime.
          </p>
        </div>
      )}

      {!loading && !error && !missing && items.length === 0 && (
        <div className="mt-6 rounded-xl border border-white/10 bg-panel/40 px-6 py-12 text-center">
          <p className="text-[14px] font-bold text-white">
            {status === "ALL" ? "No requests yet." : "Nothing here yet."}
          </p>
          <p className="mt-1.5 text-[13px] text-muted">
            {status === "ALL"
              ? "Be the first person to request an anime."
              : "Try a different filter — other requests are waiting."}
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((r, i) => (
              <RequestCard
                key={r.id}
                request={r}
                rank={sort === "MOST_REQUESTED" ? i + 1 : null}
                supported={supportedIds.has(r.id)}
                busy={busyId === r.id}
                flash={flash === r.id}
                onSupport={() => void support(r)}
              />
            ))}
          </div>

          {visible && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => void load(false)}
                disabled={loadingMore}
                className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-[13px] font-bold text-white transition hover:border-primary/60 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : `Load more (${formatCount(total - items.length)})`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RequestCard({
  request,
  rank,
  supported,
  busy,
  flash,
  onSupport,
}: {
  request: AnimeRequest;
  rank: number | null;
  supported: boolean;
  busy: boolean;
  flash: boolean;
  onSupport: () => void;
}) {
  const meta = [
    request.anime_year ? String(request.anime_year) : null,
    catalogFormatLabel(request.anime_format) || null,
    request.season > 0 ? `Season ${request.season}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const added = request.status === "ADDED";
  const watchHref = request.added_anime_id
    ? `/anime/${request.added_anime_id}`
    : `/search?q=${encodeURIComponent(request.anime_title)}`;

  return (
    <div className="group flex flex-col">
      <div className="relative">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-panel ring-1 ring-white/[0.06] transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_18px_45px_rgba(0,0,0,0.55)] group-hover:ring-primary/40">
          {request.anime_cover ? (
            <Image
              src={request.anime_cover}
              alt={request.anime_title}
              fill
              sizes="(max-width:640px) 132px, (max-width:1280px) 22vw, 190px"
              className="object-cover transition duration-300 group-hover:brightness-110"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-panel-2 p-2 text-center text-[10.5px] font-semibold text-muted">
              {request.anime_title}
            </span>
          )}

          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          <span className="absolute left-2 top-2">
            <RequestStatusBadge status={request.status} />
          </span>

          {rank !== null && rank <= 99 && (
            <span className="rank-stroke pointer-events-none absolute -bottom-1 left-1 text-[42px] font-black leading-none sm:text-[54px]">
              {rank}
            </span>
          )}
        </div>
      </div>

      <h3 className="mt-2.5 line-clamp-2 px-0.5 text-[12.5px] font-bold leading-snug text-white transition-colors group-hover:text-violet-2 sm:line-clamp-none sm:truncate sm:text-[13.5px]">
        {request.anime_title}
        {request.season > 0 ? ` – Season ${request.season}` : ""}
      </h3>
      <p className="mt-0.5 truncate px-0.5 text-[11.5px] text-muted">{meta}</p>

      <p className="mt-1 flex items-center gap-1.5 px-0.5 text-[11.5px] font-bold text-amber-300">
        🔥
        <span className={flash ? "ak-pop" : ""}>
          {formatCount(request.request_count)} requests
        </span>
        <span className="ml-auto font-medium text-muted">
          {relativeDate(request.last_requested_at)}
        </span>
      </p>

      {added ? (
        <Link
          href={watchHref}
          className="bg-gradient-btn mt-2.5 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          <IconPlay className="h-3 w-3" /> Watch Now
        </Link>
      ) : supported ? (
        <span className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-[12px] font-bold text-emerald-300">
          <IconCheck className="h-3.5 w-3.5" /> Supported
        </span>
      ) : (
        <button
          type="button"
          onClick={onSupport}
          disabled={busy}
          className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-bold text-white transition hover:border-primary/60 hover:bg-white/[0.07] active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <IconPlus className="h-3.5 w-3.5" />
          )}
          Support
        </button>
      )}
    </div>
  );
}
