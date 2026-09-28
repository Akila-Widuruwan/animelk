"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, inputCls } from "./ui";

interface AnimedlAnime {
  anilistId: number;
  title: string;
  banner: string;
  cover: string;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export default function AnimedlImport() {
  const sb = supabaseBrowser();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<AnimedlAnime[]>([]);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState<number | null>(null);

  const search = async (q: string) => {
    setBusy(true);
    setMessage("");
    setSearched(true);
    try {
      const res = await fetch(`/api/animedl?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { ok: boolean; results?: AnimedlAnime[] };
      setResults(data.results ?? []);
      if (!(data.results ?? []).length) {
        setMessage("No matches in the latest AnimeDL releases. Try a different title.");
      }
    } catch {
      setMessage("Search failed — AnimeDL may be unreachable right now.");
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  const applyImages = async (a: AnimedlAnime) => {
    setWorkingId(a.anilistId);
    setMessage("");
    const slug = slugify(a.title) || `anime-${a.anilistId}`;
    const { data: existing } = await sb
      .from("anime")
      .select("id")
      .eq("anilist_id", a.anilistId)
      .maybeSingle();
    const existingId = (existing as { id?: number } | null)?.id;

    if (existingId) {
      const { error } = await sb
        .from("anime")
        .update({ banner_image: a.banner || null, cover_image: a.cover || null })
        .eq("id", existingId);
      setWorkingId(null);
      setMessage(
        error ? `Update failed: ${error.message}` : `"${a.title}" images updated.`
      );
      return;
    }

    const { error } = await sb.from("anime").insert({
      slug,
      anilist_id: a.anilistId,
      title: a.title,
      romaji: null,
      description: null,
      banner_image: a.banner || null,
      cover_image: a.cover || null,
      format: "TV",
      status: "FINISHED",
      episodes_count: 0,
      age_rating: "PG-13",
      quality: "HD",
    });
    setWorkingId(null);
    setMessage(
      error ? `Add failed: ${error.message}` : `"${a.title}" added with its cover & banner.`
    );
  };

  return (
    <div>
      <div className="rounded-xl border border-white/10 bg-panel p-6">
        <h3 className="text-[15px] font-bold text-white">AnimeDL covers & banners</h3>
        <p className="mt-1 text-[13px] text-muted">
          Search animedl.to releases for anime covers and banners (AniList-hosted images).
          Add a new anime with those images, or refresh the images of an existing one by
          AniList id.
        </p>

        <form
          className="mt-4 flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
        >
          <input
            className={inputCls}
            placeholder="e.g. One Piece, Solo Leveling..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" disabled={busy || !query.trim()}>
            {busy ? "Searching..." : "Search"}
          </Button>
        </form>

        {message && (
          <p
            className={`mt-4 rounded-lg px-3 py-2 text-[13px] ${
              message.startsWith("Add failed") || message.startsWith("Update failed")
                ? "bg-red-500/10 text-red-300"
                : "bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {message}
          </p>
        )}
      </div>

      {searched && !busy && results.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((a) => (
            <div
              key={a.anilistId}
              className="overflow-hidden rounded-xl border border-white/10 bg-panel"
            >
              {a.banner ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.banner}
                  alt={a.title}
                  className="h-24 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-24 w-full bg-panel-2" />
              )}
              <div className="flex gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.cover}
                  alt={a.title}
                  className="h-20 w-14 shrink-0 rounded object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-white" title={a.title}>
                    {a.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">AniList #{a.anilistId}</p>
                  <Button
                    className="mt-2 px-2.5 py-1 text-xs"
                    disabled={workingId === a.anilistId}
                    onClick={() => applyImages(a)}
                  >
                    {workingId === a.anilistId ? "Working..." : "Add / Update images"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {searched && !busy && results.length === 0 && !message && (
        <p className="mt-6 text-center text-[13px] text-muted">Nothing found.</p>
      )}
    </div>
  );
}
