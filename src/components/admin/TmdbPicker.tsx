"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  BACKDROP_FINAL_SIZE,
  POSTER_FINAL_SIZE,
  tmdbImageUrl,
  type TmdbImagesResult,
  type TmdbSearchItem,
  type TmdbSearchResult,
} from "@/lib/tmdb";
import { Button, inputCls } from "./ui";

export interface TmdbSelectedImage {
  url: string;
  filePath: string;
  width: number;
  height: number;
  lang: string;
  kind: "poster" | "backdrop";
}

interface Props {
  mode: "form" | "tab";
  target?: "cover" | "banner";
  onSelect?: (image: TmdbSelectedImage) => void;
  onClose?: () => void;
}

interface AnimeOption {
  id: number;
  title: string;
}

export default function TmdbPicker({ mode, target = "cover", onSelect, onClose }: Props) {
  const sb = supabaseBrowser();

  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<"tv" | "movie">("tv");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<TmdbSearchItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [item, setItem] = useState<TmdbSearchItem | null>(null);
  const [mediaTab, setMediaTab] = useState<"posters" | "backdrops">("posters");
  const [images, setImages] = useState<TmdbImagesResult | null>(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState("");

  const [preview, setPreview] = useState<TmdbSelectedImage | null>(null);
  const [pending, setPending] = useState<TmdbSelectedImage | null>(null);

  const [animeList, setAnimeList] = useState<AnimeOption[]>([]);
  const [applyAnimeId, setApplyAnimeId] = useState<number | "">("");
  const [applyMsg, setApplyMsg] = useState("");
  const [applyErr, setApplyErr] = useState("");

  const reqIdRef = useRef(0);

  const authedFetch = useCallback(async (url: string) => {
    const { data } = await sb.auth.getSession();
    return fetch(url, {
      headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
    });
  }, [sb]);

  const runSearch = useCallback(
    async (q: string, type: "tv" | "movie", pg: number, append: boolean) => {
      const reqId = ++reqIdRef.current;
      if (pg === 1) setSearching(true);
      else setLoadingMore(true);
      setSearchError("");
      try {
        const res = await authedFetch(
          `/api/tmdb?action=search&q=${encodeURIComponent(q)}&type=${type}&page=${pg}`
        );
        const data = (await res.json()) as { ok: boolean; error?: string; data?: TmdbSearchResult };
        if (reqId !== reqIdRef.current) return;
        if (!data.ok || !data.data) {
          setSearchError(data.error || "Unable to connect to TMDB. Please try again.");
          if (pg === 1) setResults([]);
          return;
        }
        setResults((prev) => (append ? [...prev, ...data.data!.results] : data.data!.results));
        setPage(pg);
        setTotalPages(data.data!.totalPages);
      } catch {
        if (reqId === reqIdRef.current) setSearchError("Unable to connect to TMDB. Please try again.");
      } finally {
        if (reqId === reqIdRef.current) {
          setSearching(false);
          setLoadingMore(false);
        }
      }
    },
    [authedFetch]
  );

  const clearResults = useCallback(() => {
    reqIdRef.current++;
    setResults([]);
    setTotalPages(1);
    setPage(1);
    setSearching(false);
    setSearchError("");
  }, []);

  // debounced live search
  useEffect(() => {
    if (query.trim().length < 2) return;
    const t = setTimeout(() => runSearch(query, mediaType, 1, false), 350);
    return () => clearTimeout(t);
  }, [query, mediaType, runSearch]);

  const onQueryChange = (v: string) => {
    setQuery(v);
    if (v.trim().length < 2) clearResults();
  };

  const loadImages = useCallback(
    async (it: TmdbSearchItem) => {
      setItem(it);
      setImages(null);
      setImagesLoading(true);
      setImagesError("");
      setMediaTab("posters");
      setPreview(null);
      setApplyMsg("");
      setApplyErr("");
      try {
        const res = await authedFetch(`/api/tmdb?action=images&type=${it.mediaType}&id=${it.id}`);
        const data = (await res.json()) as { ok: boolean; error?: string; data?: TmdbImagesResult };
        if (!data.ok || !data.data) {
          setImagesError(data.error || "Unable to load TMDB images. Please try again.");
          return;
        }
        setImages(data.data);
      } catch {
        setImagesError("Unable to load TMDB images. Please try again.");
      } finally {
        setImagesLoading(false);
      }
    },
    [authedFetch]
  );

  useEffect(() => {
    if (mode !== "tab") return;
    let ignore = false;
    (async () => {
      const { data } = await sb.from("anime").select("id, title").order("title").limit(400);
      if (!ignore) setAnimeList((data as unknown as AnimeOption[]) ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [sb, mode]);

  const kindMatchesTarget = (kind: "poster" | "backdrop") =>
    mode === "tab" || (target === "cover" ? kind === "poster" : kind === "backdrop");

  const selectImage = (img: TmdbSelectedImage) => {
    setPreview(null);
    if (mode === "form") {
      onSelect?.(img);
      onClose?.();
    } else {
      setPending(img);
      setApplyMsg("");
      setApplyErr("");
    }
  };

  const applyToAnime = async (img: TmdbSelectedImage | null, field: "cover" | "banner") => {
    setApplyErr("");
    setApplyMsg("");
    if (!img) {
      setApplyErr(`Select a ${field === "cover" ? "poster" : "backdrop"} first (click “Select” on an image).`);
      return;
    }
    const wanted: "poster" | "backdrop" = field === "cover" ? "poster" : "backdrop";
    if (img.kind !== wanted) {
      setApplyErr(`That is a ${img.kind} — pick a ${wanted} for the ${field === "cover" ? "cover" : "banner"} field.`);
      return;
    }
    if (!applyAnimeId) {
      setApplyErr("Pick an anime to apply this image to.");
      return;
    }
    const { error } = await sb
      .from("anime")
      .update(field === "cover" ? { cover_image: img.url } : { banner_image: img.url })
      .eq("id", applyAnimeId);
    if (error) {
      setApplyErr("Unable to apply image. Please try again.");
      return;
    }
    setPending(null);
    setApplyMsg(field === "cover" ? "Poster selected successfully." : "Backdrop selected successfully.");
  };

  const grid = (tab: "posters" | "backdrops") => {
    const kind: "poster" | "backdrop" = tab === "posters" ? "poster" : "backdrop";
    const list = images?.[tab] ?? [];
    const thumbSize = kind === "poster" ? "w342" : "w780";
    const aspect = kind === "poster" ? "aspect-[2/3]" : "aspect-video";
    return list.map((img) => {
      const info: TmdbSelectedImage = {
        url: tmdbImageUrl(img.filePath, kind === "poster" ? POSTER_FINAL_SIZE : BACKDROP_FINAL_SIZE),
        filePath: img.filePath,
        width: img.width,
        height: img.height,
        lang: img.lang,
        kind,
      };
      const compatible = kindMatchesTarget(kind);
      const isPending = mode === "tab" && pending?.filePath === img.filePath;
      return (
        <div
          key={img.filePath}
          className={`overflow-hidden rounded-xl border bg-panel transition ${
            isPending
              ? "border-primary ring-1 ring-primary/50"
              : compatible
                ? "border-white/10 hover:border-primary/60"
                : "border-white/5 opacity-50"
          }`}
        >
          <button
            onClick={() => setPreview(info)}
            className={`relative block w-full overflow-hidden bg-panel-2 ${aspect}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tmdbImageUrl(img.filePath, thumbSize)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </button>
          <div className="p-2.5">
            <p className="text-[11px] font-semibold text-white/85">
              {img.width}×{img.height}
              <span className="ml-2 text-muted">{img.lang === "–" ? "no lang" : img.lang}</span>
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="ghost" className="flex-1 px-2 py-1 text-[11px]" onClick={() => setPreview(info)}>
                Preview
              </Button>
              <Button
                className="flex-1 px-2 py-1 text-[11px]"
                disabled={!compatible}
                onClick={() => selectImage(info)}
              >
                {mode === "form"
                  ? target === "cover"
                    ? "Use as Poster"
                    : "Use as Backdrop"
                  : isPending
                    ? "Selected ✓"
                    : "Select"}
              </Button>
            </div>
          </div>
        </div>
      );
    });
  };

  const emptySearch = !searching && !searchError && query.trim().length >= 2 && results.length === 0;
  const emptyImages = !imagesLoading && !imagesError && images && (mediaTab === "posters" ? images.posters.length === 0 : images.backdrops.length === 0);

  const body = item ? (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">{item.title}</h3>
          <p className="text-[12px] text-muted">
            {item.mediaType === "tv" ? "TV Series" : "Movie"}
            {item.year ? ` · ${item.year}` : ""} · TMDB ID: {item.id}
          </p>
        </div>
        <Button variant="ghost" onClick={() => setItem(null)}>
          ← Back to Search Results
        </Button>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setMediaTab("posters")}
          className={`rounded-full px-4 py-2 text-[13px] font-bold transition ${
            mediaTab === "posters" ? "bg-gradient-btn text-white" : "border border-white/10 text-muted hover:text-white"
          }`}
        >
          Posters
        </button>
        <button
          onClick={() => setMediaTab("backdrops")}
          className={`rounded-full px-4 py-2 text-[13px] font-bold transition ${
            mediaTab === "backdrops" ? "bg-gradient-btn text-white" : "border border-white/10 text-muted hover:text-white"
          }`}
        >
          Backdrops
        </button>
      </div>

      {mode === "form" && (
        <p className="mb-3 text-[12px] text-muted">
          {target === "cover"
            ? "Selecting a poster fills the Cover image field. Backdrops are disabled for this field."
            : "Selecting a backdrop fills the Banner image field. Posters are disabled for this field."}
        </p>
      )}

      {imagesLoading && <p className="py-10 text-center text-sm text-muted">Loading {mediaTab}...</p>}
      {imagesError && <p className="py-10 text-center text-sm text-red-300">{imagesError}</p>}
      {emptyImages && (
        <p className="py-10 text-center text-sm text-muted">
          No {mediaTab} are available for this title.
        </p>
      )}
      {images && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {grid(mediaTab)}
        </div>
      )}

      {mode === "tab" && (
        <div className="mt-6 rounded-xl border border-white/10 bg-ink p-4">
          <p className="mb-2 text-[13px] font-bold text-white">Apply a selected image to an anime</p>
          <p className="mb-3 text-[12px] text-muted">
            {pending
              ? `Selected: ${pending.kind} · ${pending.width}×${pending.height}`
              : "Pick an image (click “Select”), then choose the anime and which field to update."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${inputCls} max-w-xs`}
              value={applyAnimeId}
              onChange={(e) => setApplyAnimeId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Choose anime...</option>
              {animeList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <Button onClick={() => applyToAnime(pending, "cover")}>Apply as Poster</Button>
            <Button variant="ghost" onClick={() => applyToAnime(pending, "banner")}>
              Apply as Backdrop
            </Button>
          </div>
          {applyMsg && <p className="mt-2 text-[12px] text-emerald-300">{applyMsg}</p>}
          {applyErr && <p className="mt-2 text-[12px] text-red-300">{applyErr}</p>}
        </div>
      )}
    </div>
  ) : (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputCls} flex-1`}
          placeholder="Search anime titles... (English, Japanese or romanized)"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim().length >= 2) runSearch(query, mediaType, 1, false);
          }}
        />
        <Button disabled={query.trim().length < 2 || searching} onClick={() => runSearch(query, mediaType, 1, false)}>
          {searching ? "Searching…" : "Search"}
        </Button>
        {query && (
          <Button variant="ghost" onClick={() => setQuery("")}>
            Clear
          </Button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[12px] font-semibold text-muted">Search type:</span>
        <select
          className={`${inputCls} w-auto`}
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value === "movie" ? "movie" : "tv")}
        >
          <option value="tv">TV Series</option>
          <option value="movie">Movies</option>
        </select>
      </div>

      {searching && <p className="py-10 text-center text-sm text-muted">Searching TMDB...</p>}
      {searchError && <p className="py-10 text-center text-sm text-red-300">{searchError}</p>}
      {emptySearch && (
        <p className="py-10 text-center text-sm text-muted">
          No matching titles found. Try another title or search term.
        </p>
      )}

      {results.length > 0 && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => (
              <div key={`${r.mediaType}-${r.id}`} className="flex gap-3 rounded-xl border border-white/10 bg-panel p-3">
                <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-panel-2">
                  {r.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tmdbImageUrl(r.posterPath, "w185")} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-muted">No image</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-white">{r.title}</p>
                  {r.originalTitle && r.originalTitle !== r.title && (
                    <p className="truncate text-[12px] text-muted">{r.originalTitle}</p>
                  )}
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    {r.mediaType === "tv" ? "TV Series" : "Movie"}
                    {r.year ? ` · ${r.year}` : ""} · TMDB {r.id}
                  </p>
                  {r.overview && <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-body">{r.overview}</p>}
                  <Button className="mt-2 px-3 py-1.5 text-[12px]" onClick={() => loadImages(r)}>
                    View Media
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {page < totalPages && (
            <div className="mt-5 text-center">
              <Button variant="ghost" disabled={loadingMore} onClick={() => runSearch(query, mediaType, page + 1, true)}>
                {loadingMore ? "Loading…" : "Load More"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const content = (
    <div>
      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-2xl border border-white/10 bg-panel p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-[13px] font-bold text-white">
                {preview.kind === "poster" ? "Poster" : "Backdrop"} · {preview.width}×{preview.height} ·{" "}
                {preview.lang === "–" ? "no language" : preview.lang}
              </p>
              <button
                onClick={() => setPreview(null)}
                aria-label="Close preview"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt=""
              className={`mx-auto max-h-[70vh] object-contain ${preview.kind === "poster" ? "max-w-[46vw]" : "max-w-[80vw]"}`}
            />
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Close
              </Button>
              <Button
                disabled={!kindMatchesTarget(preview.kind)}
                onClick={() => selectImage(preview)}
              >
                {mode === "form"
                  ? target === "cover"
                    ? "Use as Anime Poster"
                    : "Use as Anime Backdrop"
                  : "Select This Image"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-white">TMDB Media Search</h3>
        {mode === "tab" && (
          <p className="text-[10px] text-muted">
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        )}
      </div>

      <div className="mt-3">{body}</div>
    </div>
  );

  if (mode === "form") {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10">
        <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">
              {target === "cover" ? "Search TMDB Posters" : "Search TMDB Backdrops"}
            </h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/70 hover:text-white"
            >
              ✕
            </button>
          </div>
          {content}
        </div>
      </div>
    );
  }

  return <div>{content}</div>;
}
