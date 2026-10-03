"use client";

import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AnilistMedia } from "@/lib/anilist";
import { Button } from "./ui";

interface LinkedInfo {
  id: number;
  titleEnglish: string | null;
  titleRomaji: string | null;
  status: string | null;
  seasonYear: number | null;
  episodes: number | null;
  nextEpisode: number | null;
  nextAiringAt: number | null;
  timeUntilAiring: number | null;
}

interface AiringRow {
  animeId: number;
  title: string;
  dbStatus: string;
  anilistId: number | null;
  linked: LinkedInfo | null;
  suggested: LinkedInfo | null;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function countdown(ts: number): string {
  const diff = ts * 1000 - Date.now();
  if (diff <= 0) return "Aired";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

function statusBadge(status: string | null): { label: string; cls: string } {
  switch (status) {
    case "RELEASING":
      return { label: "Airing", cls: "bg-emerald-500/15 text-emerald-300" };
    case "NOT_YET_RELEASED":
      return { label: "Upcoming", cls: "bg-sky-500/15 text-sky-300" };
    case "FINISHED":
      return { label: "Finished", cls: "bg-white/10 text-white/70" };
    case "HIATUS":
      return { label: "Hiatus", cls: "bg-amber-500/15 text-amber-300" };
    default:
      return { label: status ?? "—", cls: "bg-white/5 text-muted" };
  }
}

export default function AiringSchedule() {
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const [checked, setChecked] = useState(0);
  const [rows, setRows] = useState<AiringRow[]>([]);
  const [error, setError] = useState("");
  const [searchFor, setSearchFor] = useState<number | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<AnilistMedia[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const openSearch = (animeId: number) => {
    if (searchFor === animeId) {
      setSearchFor(null);
      return;
    }
    setSearchQ("");
    setSearchResults(null);
    setSearchFor(animeId);
  };

  const authedFetch = async (path: string, init?: RequestInit) => {
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getSession();
    if (!data.session) throw new Error("Not logged in");
    const res = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      signal: init?.signal,
    });
    if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
    return res;
  };

  const sync = async () => {
    setRunning(true);
    setError("");
    setRows([]);
    setChecked(0);
    setTotal(0);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await authedFetch("/api/airing?action=sync", { signal: controller.signal });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const readMore = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "total") setTotal(msg.total);
            else if (msg.type === "result") {
              setRows((prev) => [...prev, msg.result]);
              setChecked((prev) => prev + 1);
            } else if (msg.type === "done") {
              setTotal(msg.total);
              setChecked(msg.checked);
            }
          } catch {
            // skip malformed line
          }
        }
        await readMore();
      };
      await readMore();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Sync failed — try again.");
    } finally {
      setRunning(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const runSearch = async (q: string) => {
    setSearching(true);
    try {
      const res = await authedFetch(
        `/api/airing?action=search&q=${encodeURIComponent(q)}`
      );
      const json = (await res.json()) as { ok: boolean; data?: AnilistMedia[] };
      setSearchResults(json.data ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const link = async (animeId: number, anilistId: number | null) => {
    setLinking(animeId);
    try {
      const res = await authedFetch("/api/airing", {
        method: "POST",
        body: JSON.stringify({ animeId, anilistId }),
      });
      const json = (await res.json()) as { ok: boolean };
      if (!json.ok) throw new Error("link failed");
      setSearchFor(null);
      await sync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link failed");
    } finally {
      setLinking(null);
    }
  };

  const progress = total > 0 ? Math.round((checked / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-white">Release Dates</h2>
          <p className="mt-1 text-[13px] text-muted">
            Real next-episode release dates from AniList for every airing anime.
            Link an AniList title once, then sync anytime for live data.
          </p>
        </div>
        {running ? (
          <Button variant="danger" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button onClick={sync}>Sync release dates</Button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>
      )}

      {(running || total > 0) && (
        <div className="rounded-xl border border-white/10 bg-panel p-5">
          <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-white/80">
            <span>
              {running ? "Syncing…" : "Finished"}{" "}
              <span className="text-muted">
                {checked}/{total} anime
              </span>
            </span>
            <span className="tabular-nums text-white">{progress}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink">
            <div
              className="h-full rounded-full bg-gradient-btn transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-panel">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Anime</th>
                <th className="px-4 py-3 font-semibold">AniList status</th>
                <th className="px-4 py-3 font-semibold">Next episode</th>
                <th className="px-4 py-3 font-semibold">Release date</th>
                <th className="px-4 py-3 font-semibold">Countdown</th>
                <th className="px-4 py-3 font-semibold">AniList link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((r) => {
                const info = r.linked ?? r.suggested;
                const st = statusBadge(info?.status ?? null);
                return (
                  <tr key={r.animeId}>
                    <td className="max-w-[240px] px-4 py-3">
                      <p className="truncate font-semibold text-white">{r.title}</p>
                      {r.linked ? (
                        <p className="mt-0.5 text-[11px] text-muted">
                          {r.linked.titleEnglish ?? r.linked.titleRomaji ?? ""}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[11px] text-amber-300/80">
                          not linked
                          {r.suggested
                            ? ` — suggested: ${r.suggested.titleEnglish ?? r.suggested.titleRomaji ?? `#${r.suggested.id}`}`
                            : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-white/80">
                      {info?.nextEpisode
                        ? `EP ${info.nextEpisode}`
                        : info?.status === "FINISHED"
                          ? `${info.episodes ?? "?"} eps`
                          : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-white/80">
                      {info?.nextAiringAt ? formatDate(info.nextAiringAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {info?.nextAiringAt ? (
                        <span className="font-bold text-emerald-300">
                          {countdown(info.nextAiringAt)}
                        </span>
                      ) : info?.status === "FINISHED" ? (
                        <span className="text-muted">finished</span>
                      ) : (
                        <span className="text-muted">no next ep announced</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.linked ? (
                        <a
                          href={`https://anilist.co/anime/${r.linked.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-primary transition hover:text-violet-2"
                        >
                          AniList ↗
                        </a>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <Button
                            variant="ghost"
                            className="!px-2.5 !py-1 text-[11px]"
                            onClick={() => openSearch(r.animeId)}
                          >
                            Link AniList…
                          </Button>
                          {r.suggested && (
                            <Button
                              variant="ghost"
                              className="!px-2.5 !py-1 text-[11px]"
                              disabled={linking === r.animeId}
                              onClick={() => link(r.animeId, r.suggested!.id)}
                            >
                              {linking === r.animeId
                                ? "Linking…"
                                : `Link suggested #${r.suggested.id}`}
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {searchFor !== null && (
        <div className="rounded-xl border border-primary/30 bg-panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">
              Find AniList title for{" "}
              <span className="text-primary">
                {rows.find((r) => r.animeId === searchFor)?.title ?? ""}
              </span>
            </h3>
            <button
              onClick={() => setSearchFor(null)}
              className="text-[12px] font-bold text-muted transition hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQ.trim().length >= 2) {
                  void runSearch(searchQ);
                }
              }}
              placeholder="Search AniList…"
              className="w-full max-w-sm rounded-lg border border-white/10 bg-ink px-3 py-2 text-[13px] text-white outline-none transition placeholder:text-muted focus:border-primary/60"
            />
            <Button
              disabled={searching || searchQ.trim().length < 2}
              onClick={() => runSearch(searchQ)}
            >
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>
          {searchResults && (
            <div className="mt-3 space-y-1.5">
              {searchResults.length === 0 && (
                <p className="text-[13px] text-muted">No results.</p>
              )}
              {searchResults.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-ink px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white">
                      {m.titleEnglish ?? m.titleRomaji ?? `#${m.id}`}
                    </p>
                    <p className="text-[11px] text-muted">
                      {m.format} · {m.seasonYear ?? "?"} · #{m.id}
                      {m.nextEpisode
                        ? ` · next EP ${m.nextEpisode}`
                        : m.status
                          ? ` · ${m.status}`
                          : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="!px-2.5 !py-1 text-[11px]"
                    disabled={linking === searchFor}
                    onClick={() => link(searchFor, m.id)}
                  >
                    Link
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
