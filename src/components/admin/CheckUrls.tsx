"use client";

import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { CheckStatus } from "@/lib/checkUrls";
import { Button } from "./ui";

interface CheckRow {
  animeId: number;
  animeTitle: string;
  episode: number;
  server: number;
  url: string;
  status: CheckStatus;
  httpStatus?: number;
  note?: string;
}

type Filter = "all" | "dead" | "error";

const STATUS_BADGE: Record<CheckStatus, string> = {
  alive: "bg-emerald-500/15 text-emerald-300",
  dead: "bg-red-500/15 text-red-300",
  error: "bg-amber-500/15 text-amber-300",
};

export default function CheckUrls() {
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const [checked, setChecked] = useState(0);
  const [results, setResults] = useState<CheckRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const counts = results.reduce(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { alive: 0, dead: 0, error: 0 } as Record<CheckStatus, number>
  );

  const start = async () => {
    setRunning(true);
    setError("");
    setResults([]);
    setChecked(0);
    setTotal(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        setError("Not logged in — sign in again.");
        setRunning(false);
        return;
      }

      const res = await fetch("/api/check-urls", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        setError(`Request failed (HTTP ${res.status})`);
        setRunning(false);
        return;
      }

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
            if (msg.type === "total") {
              setTotal(msg.total);
            } else if (msg.type === "result") {
              setResults((prev) => [...prev, msg.result]);
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
      if ((e as Error).name !== "AbortError") {
        setError("Check failed — try again.");
      }
    } finally {
      setRunning(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const progress = total > 0 ? Math.round((checked / total) * 100) : 0;

  const visible =
    filter === "all" ? results : results.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-white">Check URLs</h2>
          <p className="mt-1 text-[13px] text-muted">
            Verifies every video URL added to episodes (abyss embeds, archive.org
            files, direct links) and flags dead ones with the anime, episode and
            server slot.
          </p>
        </div>
        {running ? (
          <Button variant="danger" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button onClick={start}>Start check</Button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>
      )}

      {(running || total > 0) && (
        <div className="rounded-xl border border-white/10 bg-panel p-5">
          <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-white/80">
            <span>
              {running ? "Checking…" : "Finished"}{" "}
              <span className="text-muted">
                {checked}/{total} URLs
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

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-panel p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Total</p>
              <p className="mt-1 text-2xl font-extrabold text-white">{results.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-panel p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Alive</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-300">{counts.alive}</p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-panel p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Dead</p>
              <p className="mt-1 text-2xl font-extrabold text-red-300">{counts.dead}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-panel p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Errors</p>
              <p className="mt-1 text-2xl font-extrabold text-amber-300">{counts.error}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {(["all", "dead", "error"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                  filter === f
                    ? "bg-primary/25 text-white"
                    : "bg-white/5 text-muted hover:text-white"
                }`}
              >
                {f === "all" ? "All" : f === "dead" ? "Dead only" : "Errors only"}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-panel">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Anime</th>
                  <th className="px-4 py-3 font-semibold">Episode</th>
                  <th className="px-4 py-3 font-semibold">Server</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">HTTP</th>
                  <th className="px-4 py-3 font-semibold">URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {visible.map((r, i) => (
                  <tr
                    key={i}
                    className={
                      r.status === "dead"
                        ? "bg-red-500/[0.06]"
                        : r.status === "error"
                          ? "bg-amber-500/[0.05]"
                          : ""
                    }
                  >
                    <td className="max-w-[220px] truncate px-4 py-2.5 font-semibold text-white">
                      {r.animeTitle}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-white/80">{r.episode}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-white/80">
                        0{r.server}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[r.status]}`}
                      >
                        {r.status === "alive" ? "Alive" : r.status === "dead" ? "Dead" : "Error"}
                      </span>
                      {r.note && (
                        <span className="ml-2 text-[11px] text-muted">{r.note}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-white/60">
                      {r.httpStatus ?? "—"}
                    </td>
                    <td className="max-w-[320px] truncate px-4 py-2.5 text-white/70" title={r.url}>
                      {r.url}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
