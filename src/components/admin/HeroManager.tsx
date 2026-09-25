"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Thumb, inputCls } from "./ui";

interface SlideRow {
  id: number;
  position: number;
  anime: { id: number; title: string; banner_image: string | null } | null;
}

export default function HeroManager() {
  const sb = supabaseBrowser();
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; title: string; banner_image: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await sb
      .from("hero_slides")
      .select("id, position, anime(id, title, banner_image)")
      .order("position");
    setSlides((data as unknown as SlideRow[]) ?? []);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    let ignore = false;
    async function fetchAll() {
      const { data } = await sb
        .from("hero_slides")
        .select("id, position, anime(id, title, banner_image)")
        .order("position");
      if (ignore) return;
      setSlides((data as unknown as SlideRow[]) ?? []);
      setLoading(false);
    }
    fetchAll();
    return () => {
      ignore = true;
    };
  }, [sb]);

  useEffect(() => {
    if (query.length < 2) return;
    let ignore = false;
    const t = setTimeout(async () => {
      const { data } = await sb
        .from("anime")
        .select("id, title, banner_image")
        .ilike("title", `%${query}%`)
        .limit(8);
      if (!ignore) {
        setResults(
          (data as unknown as { id: number; title: string; banner_image: string | null }[]) ?? []
        );
      }
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(t);
    };
  }, [query, sb]);

  const add = async (animeId: number) => {
    const { data } = await sb.from("hero_slides").select("position");
    const positions = (data ?? []).map((r: { position: number }) => r.position);
    const next = positions.length ? Math.max(...positions) + 1 : 1;
    const { error } = await sb
      .from("hero_slides")
      .insert({ anime_id: animeId, position: next, is_active: true });
    if (error) window.alert(error.message);
    setQuery("");
    setResults([]);
    await load();
  };

  const remove = async (id: number) => {
    const { error } = await sb.from("hero_slides").delete().eq("id", id);
    if (error) window.alert(error.message);
    else await load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const list = [...slides].sort((a, b) => a.position - b.position);
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    for (const [i, s] of list.entries()) {
      const { error } = await sb
        .from("hero_slides")
        .update({ position: i + 1 })
        .eq("id", s.id);
      if (error) {
        window.alert(error.message);
        return;
      }
    }
    await load();
  };

  if (loading) return <p className="py-10 text-center text-sm text-muted">Loading...</p>;

  const sorted = [...slides].sort((a, b) => a.position - b.position);

  return (
    <div>
      <div className="mb-5">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length < 2) setResults([]);
          }}
          placeholder="Search anime to add to hero..."
          className={`${inputCls} max-w-sm`}
        />
        {results.length > 0 && (
          <div className="mt-2 flex w-full max-w-sm flex-col gap-1 rounded-lg border border-white/10 bg-panel p-2">
            {results.map((a) => (
              <button
                key={a.id}
                onClick={() => add(a.id)}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-white/80 hover:bg-primary/20 hover:text-white"
              >
                <Thumb src={a.banner_image} alt={a.title} className="h-8 w-14" />
                <span className="truncate">{a.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {sorted.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-panel/50 px-3 py-2">
            <span className="w-6 text-center text-sm font-extrabold text-primary">{i + 1}</span>
            <Thumb src={s.anime?.banner_image} alt={s.anime?.title ?? ""} className="h-10 w-20" />
            <span className="flex-1 truncate text-[13px] font-bold text-white">{s.anime?.title}</span>
            <Button variant="ghost" className="px-2 py-1" onClick={() => move(i, -1)} disabled={i === 0}>
              ↑
            </Button>
            <Button variant="ghost" className="px-2 py-1" onClick={() => move(i, 1)} disabled={i === sorted.length - 1}>
              ↓
            </Button>
            <Button variant="danger" className="px-2 py-1" onClick={() => remove(s.id)}>
              Remove
            </Button>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">No hero slides yet</p>
        )}
      </div>
    </div>
  );
}
