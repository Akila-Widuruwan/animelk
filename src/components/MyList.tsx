"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Anime } from "@/lib/anime";
import { fetchAnimeByIds } from "@/lib/db";
import { useViewer } from "@/lib/viewer-auth";
import {
  fetchWatchlist,
  importLocalWatchlist,
  toggleWatchlist,
} from "@/lib/viewer-data";
import { readLocalWatchlist, setLocalListed } from "@/lib/watchlist-local";
import AnimeCard from "./AnimeCard";
import { IconBookmark, IconClose } from "./Icons";

/** The grid shape used by the browse and search pages. */
const GRID =
  "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7";

export default function MyList() {
  const { viewer, loading } = useViewer();
  /** null until the first read finishes, so the empty state never flashes. */
  const [items, setItems] = useState<Anime[] | null>(null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<number[]>([]);
  /** Browser-saved titles a signed-in viewer can move into the account. */
  const [importable, setImportable] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    void (async () => {
      try {
        const ids = viewer ? await fetchWatchlist() : readLocalWatchlist();
        const rows = await fetchAnimeByIds(ids);
        if (cancelled) return;
        setItems(rows);
        setError("");
        if (viewer) {
          // Titles this browser saved before signing in are offered once, and
          // only for what the account is still missing.
          const saved = new Set(ids);
          setImportable(readLocalWatchlist().filter((id) => !saved.has(id)));
        } else {
          setImportable([]);
        }
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setError(
          err instanceof Error ? err.message : "Could not load your list."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, viewer]);

  const remove = async (anime: Anime) => {
    setError("");
    setRemoving((prev) => [...prev, anime.id]);
    try {
      if (viewer) await toggleWatchlist(anime.id, false);
      // The browser copy is kept in step so a later sign-out cannot resurrect
      // a title the viewer just deleted.
      setLocalListed(anime.id, false);
      setItems((prev) => (prev ? prev.filter((a) => a.id !== anime.id) : prev));
      setImportable((prev) => prev.filter((id) => id !== anime.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update your list."
      );
    } finally {
      setRemoving((prev) => prev.filter((id) => id !== anime.id));
    }
  };

  const moveSavedTitles = async () => {
    setImporting(true);
    setImportMessage("");
    try {
      const added = await importLocalWatchlist(importable);
      const ids = viewer ? await fetchWatchlist() : [];
      const rows = await fetchAnimeByIds(ids);
      setItems(rows);
      setImportable([]);
      setImportMessage(
        added > 0
          ? `Added ${added} title${added === 1 ? "" : "s"} to your account.`
          : "Those titles were already in your account."
      );
    } catch (err) {
      setImportMessage(
        err instanceof Error ? err.message : "Could not move your list."
      );
    } finally {
      setImporting(false);
    }
  };

  if (items === null) {
    return (
      <div className={GRID} aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className="block aspect-[2/3] animate-pulse rounded-xl bg-panel"
          />
        ))}
      </div>
    );
  }

  const signInHref = `/login?next=${encodeURIComponent("/my-list")}`;

  return (
    <>
      {importable.length > 0 && (
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-2/30 bg-violet-2/10 px-5 py-4">
          <p className="text-[13.5px] text-white">
            You have{" "}
            <strong className="font-bold">
              {importable.length} title{importable.length === 1 ? "" : "s"}
            </strong>{" "}
            saved in this browser only. Add them to your account?
          </p>
          <button
            onClick={() => void moveSavedTitles()}
            disabled={importing}
            className="bg-gradient-btn rounded-full px-4 py-2 text-[12.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {importing ? "Moving…" : "Move to my account"}
          </button>
        </div>
      )}

      {importMessage && (
        <p className="mb-6 rounded-lg bg-white/5 px-4 py-2.5 text-[13px] text-body">
          {importMessage}
        </p>
      )}

      {error && (
        <p className="mb-6 rounded-lg bg-red-500/10 px-4 py-2.5 text-[13px] text-red-300">
          {error}
        </p>
      )}

      {!viewer && (
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-panel/50 px-5 py-4">
          <p className="text-[13.5px] text-body">
            This list lives in this browser. Sign in with Google and it follows
            you to every device.
          </p>
          <Link
            href={signInHref}
            className="bg-gradient-btn rounded-full px-4 py-2 text-[12.5px] font-bold text-white transition hover:opacity-90"
          >
            Continue with Google
          </Link>
        </div>
      )}

      {items.length > 0 ? (
        <>
          <p className="mb-5 text-[13.5px] text-muted">
            {items.length} title{items.length === 1 ? "" : "s"} in your list
          </p>
          <div className={GRID}>
            {items.map((anime) => (
              <div key={anime.id}>
                <AnimeCard anime={anime} />
                <button
                  onClick={() => void remove(anime)}
                  disabled={removing.includes(anime.id)}
                  className="mt-1.5 flex items-center gap-1 text-[11.5px] font-semibold text-muted transition hover:text-red-300 disabled:opacity-50"
                >
                  <IconClose className="h-3 w-3" />
                  {removing.includes(anime.id) ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-panel/40 px-6 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70">
            <IconBookmark className="h-5 w-5" />
          </span>
          <p className="mt-4 text-[15px] font-bold text-white">
            Your list is empty
          </p>
          <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-muted">
            Open any title and tap <strong className="font-bold">Add to List</strong>{" "}
            to keep it here{viewer ? "" : " — and sign in to carry it across devices"}.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/#browse"
              className="bg-gradient-btn rounded-full px-5 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90"
            >
              Browse anime
            </Link>
            {!viewer && (
              <Link
                href={signInHref}
                className="rounded-full border border-white/12 px-5 py-2.5 text-[13px] font-bold text-white transition hover:border-primary/60"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
