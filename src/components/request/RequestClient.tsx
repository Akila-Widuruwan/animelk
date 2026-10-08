"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconCheck, IconSearch } from "@/components/Icons";
import type { CatalogAnime } from "@/lib/anime-provider";
import AnimeSearch from "./AnimeSearch";
import RequestConfirmCard from "./RequestConfirmCard";
import RequestFeed from "./RequestFeed";
import {
  fetchSupportedIds,
  findMatchingRequest,
  friendlyError,
  isMissingSchema,
  requestSeasonLabel,
  submitAnimeRequest,
  supportAnimeRequest,
  type AnimeRequest,
  type RequestType,
} from "@/lib/requests";

type Toast = { title: string; subtitle: string };

const STEPS = [
  { n: 1, label: "Search the anime" },
  { n: 2, label: "Select the title" },
  { n: 3, label: "Submit your request" },
];

export default function RequestClient() {
  const [selected, setSelected] = useState<CatalogAnime | null>(null);
  const [existingRows, setExistingRows] = useState<AnimeRequest[]>([]);
  const [requestType, setRequestType] = useState<RequestType>("NEW_ANIME");
  const [season, setSeason] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [supportedIds, setSupportedIds] = useState<Set<number>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchSupportedIds()
      .then((ids) => {
        if (!ignore) setSupportedIds(ids);
      })
      .catch(() => {
        // Not migrated yet / offline — the page still works.
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5200);
    return () => clearTimeout(t);
  }, [toast]);

  const matching = useMemo(
    () => (selected ? findMatchingRequest(existingRows, selected, requestType, season) : null),
    [existingRows, selected, requestType, season]
  );

  const clearForm = useCallback(() => {
    setSelected(null);
    setExistingRows([]);
    setRequestType("NEW_ANIME");
    setSeason(1);
    setMessage("");
    setError("");
  }, []);

  const handleSelect = (anime: CatalogAnime, existing: AnimeRequest[]) => {
    setSelected(anime);
    setExistingRows(existing);
    setRequestType("NEW_ANIME");
    setSeason(1);
    setMessage("");
    setError("");
  };

  const markSupported = (request: AnimeRequest) => {
    setSupportedIds((prev) => new Set(prev).add(request.id));
    setExistingRows((prev) =>
      prev.map((r) => (r.id === request.id ? { ...r, ...request } : r))
    );
  };

  const reportError = (e: unknown, fallback: string) => {
    if (isMissingSchema(e)) {
      setError("Requests aren't available right now. Please try again later.");
      return;
    }
    setError(friendlyError(e, fallback));
  };

  const handleSubmit = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await submitAnimeRequest({
        anime: selected,
        requestType,
        season: requestType === "NEW_SEASON" ? season : 0,
        seasonLabel: requestType === "NEW_SEASON" ? requestSeasonLabel(season) : null,
        message,
      });
      markSupported(result.request);
      setReloadKey((k) => k + 1);
      if (result.alreadySupported) {
        setToast({
          title: "You already supported this request",
          subtitle: "Your support was counted earlier — thanks!",
        });
      } else if (result.created) {
        setToast({
          title: "Request submitted successfully!",
          subtitle: "We'll consider adding this anime based on demand.",
        });
      } else {
        setToast({
          title: "You supported this request!",
          subtitle: "We'll consider adding this anime based on demand.",
        });
      }
      clearForm();
    } catch (e) {
      reportError(e, "We couldn't submit your request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSupport = async () => {
    if (!matching || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await supportAnimeRequest(matching.id, message);
      markSupported(result.request);
      setReloadKey((k) => k + 1);
      setToast(
        result.alreadySupported
          ? {
              title: "You already supported this request",
              subtitle: "Your support was counted earlier — thanks!",
            }
          : {
              title: "Request supported!",
              subtitle: "We'll consider adding this anime based on demand.",
            }
      );
      clearForm();
    } catch (e) {
      reportError(e, "We couldn't add your support. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <header className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-violet-2">
          <IconSearch className="h-3 w-3" /> Request Anime
        </span>
        <h1 className="mt-4 text-[28px] font-extrabold leading-tight tracking-tight text-white sm:text-[38px]">
          Request an Anime
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[13.5px] leading-relaxed text-body sm:text-[15px]">
          Can&apos;t find the anime you&apos;re looking for? Search for it and request it
          here.
        </p>
      </header>

      <div className="mx-auto mt-6 max-w-2xl">
        <AnimeSearch onSelect={handleSelect} selectedId={selected?.externalId ?? null} />
        <p className="mt-2.5 text-center text-[12px] text-muted">
          Search by anime title, Japanese title, or alternative title.
        </p>
      </div>

      <div className="mx-auto mt-6 flex max-w-2xl items-center justify-center gap-2 sm:gap-4">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  selected && i < 2
                    ? "bg-emerald-500/20 text-emerald-300"
                    : i === 0 || (selected && i === 2)
                      ? "bg-gradient-btn text-white"
                      : "border border-white/10 text-white/50"
                }`}
              >
                {selected && i < 2 ? <IconCheck className="h-3 w-3" /> : s.n}
              </span>
              <span className="hidden text-[12px] font-semibold text-white/70 sm:block">
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="h-px w-4 bg-white/15 sm:w-8" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-2xl">
        {selected ? (
          <RequestConfirmCard
            anime={selected}
            requestType={requestType}
            onRequestType={(t) => {
              setRequestType(t);
              setError("");
            }}
            season={season}
            onSeason={setSeason}
            message={message}
            onMessage={setMessage}
            existing={matching}
            supported={matching ? supportedIds.has(matching.id) : false}
            busy={busy}
            error={error}
            onSubmit={() => void handleSubmit()}
            onSupport={() => void handleSupport()}
            onClear={clearForm}
          />
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-[14px] font-bold text-white">
              Search for an anime you want to see on AniLanka.
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted">
              Pick a result and we&apos;ll track the demand for it.
            </p>
          </div>
        )}
      </div>

      <RequestFeed
        reloadKey={reloadKey}
        supportedIds={supportedIds}
        onSupported={(r) => {
          markSupported(r);
          setToast({
            title: "Request supported!",
            subtitle: "Thanks — your support bumps this anime up the list.",
          });
        }}
      />

      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-5 z-[60] mx-auto flex max-w-sm items-start gap-3 rounded-2xl border border-emerald-400/25 bg-panel/95 px-4 py-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl [animation:fadeInUp_0.35s_ease] sm:inset-x-auto sm:right-6"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
            <IconCheck className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-bold text-white">{toast.title}</span>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
              {toast.subtitle}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto shrink-0 text-[11px] font-bold text-muted transition hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
