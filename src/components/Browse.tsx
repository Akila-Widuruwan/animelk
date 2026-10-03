"use client";

import { useMemo, useState } from "react";
import type { Anime } from "@/lib/anime";
import { allAnime, formatLabel, year } from "@/lib/anime";
import { IconChevronDown, IconChevronLeft, IconChevronRight } from "./Icons";
import AnimeCard from "./AnimeCard";

const PER_PAGE = 14;
const TYPES = ["All", "TV Series", "Movie", "OVA", "ONA", "Special"];

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-2.5 pl-4 pr-3 text-[13px] text-white transition hover:border-primary/50">
      <span className="text-muted">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent pr-6 font-semibold outline-none [&>option]:bg-panel [&>option]:text-white"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted" />
    </label>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2.5 text-[13px] font-semibold transition duration-200 ${
        active
          ? "bg-gradient-btn text-white shadow-[0_6px_18px_rgba(124,92,255,0.4)]"
          : "border border-white/10 bg-white/5 text-muted hover:border-primary/50 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function Browse({ pool }: { pool?: Anime[] }) {
  const source = pool && pool.length > 0 ? pool : allAnime;
  const [type, setType] = useState("All");
  const [genre, setGenre] = useState("All");
  const [yearF, setYearF] = useState("All");
  const [sort, setSort] = useState("Default");
  const [page, setPage] = useState(1);

  const genres = useMemo(() => {
    const s = new Set<string>();
    source.forEach((a) => a.genres.forEach((g) => s.add(g)));
    return [...s].sort();
  }, [source]);

  const years = useMemo(
    () => [...new Set(source.map((a) => year(a)))].sort((a, b) => b - a),
    [source]
  );

  const filtered = useMemo(() => {
    let list = source.filter(
      (a) =>
        (type === "All" || formatLabel(a.format) === type) &&
        (genre === "All" || a.genres.includes(genre)) &&
        (yearF === "All" || String(year(a)) === yearF)
    );
    if (sort === "Score") list = [...list].sort((a, b) => b.averageScore - a.averageScore);
    if (sort === "Year") list = [...list].sort((a, b) => year(b) - year(a));
    if (sort === "A-Z") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [source, type, genre, yearF, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const paginate = (p: number) => setPage(Math.min(Math.max(1, p), pages));

  return (
    <div>
      <div className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:snap-none">
        {TYPES.map((t) => (
          <Pill
            key={t}
            active={type === t}
            onClick={() => {
              setType(t);
              setPage(1);
            }}
          >
            {t}
          </Pill>
        ))}
      </div>

      <div className="no-scrollbar -mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:snap-none">
        <Pill
          active={genre === "All"}
          onClick={() => {
            setGenre("All");
            setPage(1);
          }}
        >
          All Genres
        </Pill>
        {genres.map((g) => (
          <Pill
            key={g}
            active={genre === g}
            onClick={() => {
              setGenre(g);
              setPage(1);
            }}
          >
            {g}
          </Pill>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            label="Years"
            value={yearF}
            options={["All", ...years.map(String)]}
            onChange={(v) => {
              setYearF(v);
              setPage(1);
            }}
          />
          <Select
            label="Sort"
            value={sort}
            options={["Default", "Score", "Year", "A-Z"]}
            onChange={(v) => {
              setSort(v);
              setPage(1);
            }}
          />
        </div>
        <p className="text-[13px] text-muted">
          {filtered.length} title{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {shown.map((a) => (
          <AnimeCard key={a.id} anime={a} />
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2 sm:mt-10">
          <button
            onClick={() => paginate(current - 1)}
            aria-label="Previous page"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:border-primary hover:text-white"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => paginate(p)}
              className={`h-11 w-11 rounded-full text-sm font-bold transition ${
                p === current
                  ? "bg-gradient-btn text-white shadow-[0_6px_18px_rgba(124,92,255,0.4)]"
                  : "border border-white/10 text-white/70 hover:border-primary hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => paginate(current + 1)}
            aria-label="Next page"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:border-primary hover:text-white"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export type { Anime };
