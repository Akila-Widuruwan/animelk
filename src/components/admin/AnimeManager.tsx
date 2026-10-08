"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Field, Modal, StatusPill, Thumb, inputCls } from "./ui";
import EpisodesManager from "./EpisodesManager";
import TmdbPicker, { type TmdbSelectedImage } from "./TmdbPicker";

interface AnimeRow {
  id: number;
  title: string;
  romaji: string | null;
  description: string | null;
  banner_image: string | null;
  cover_image: string | null;
  format: string;
  status: string;
  season_year: number | null;
  episodes_count: number;
  duration: number | null;
  average_score: number | null;
  age_rating: string;
  quality: string;
  is_dub: boolean;
  is_new: boolean;
  is_trending: boolean;
  is_top: boolean;
  top_position: number | null;
  trailer_url: string | null;
  completed: boolean;
  is_active: boolean;
  anime_genres: { genres: { id: number; name: string } | null }[];
}

interface GenreRow {
  id: number;
  name: string;
}

interface FormState {
  title: string;
  romaji: string;
  description: string;
  banner_image: string;
  cover_image: string;
  format: string;
  status: string;
  season_year: string;
  episodes_count: string;
  duration: string;
  average_score: string;
  age_rating: string;
  quality: string;
  is_dub: boolean;
  is_new: boolean;
  is_trending: boolean;
  is_top: boolean;
  top_position: string;
  trailer_url: string;
  completed: boolean;
  is_active: boolean;
  genres: number[];
}

const emptyForm = (): FormState => ({
  title: "",
  romaji: "",
  description: "",
  banner_image: "",
  cover_image: "",
  format: "TV",
  status: "FINISHED",
  season_year: String(new Date().getFullYear()),
  episodes_count: "0",
  duration: "",
  average_score: "",
  age_rating: "PG-13",
  quality: "HD",
  is_dub: false,
  is_new: false,
  is_trending: false,
  is_top: false,
  top_position: "",
  trailer_url: "",
  completed: false,
  is_active: true,
  genres: [],
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function AnimeManager() {
  const sb = supabaseBrowser();
  const [anime, setAnime] = useState<AnimeRow[]>([]);
  const [genres, setGenres] = useState<GenreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AnimeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [episodesFor, setEpisodesFor] = useState<AnimeRow | null>(null);
  const [tmdbFor, setTmdbFor] = useState<"cover" | "banner" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, gRes] = await Promise.all([
      sb
        .from("anime")
        .select("*, anime_genres(genres(id, name))")
        .order("id", { ascending: false })
        .limit(300),
      sb.from("genres").select("id, name").order("name"),
    ]);
    setAnime((aRes.data as unknown as AnimeRow[]) ?? []);
    setGenres((gRes.data as unknown as GenreRow[]) ?? []);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    let ignore = false;
    async function fetchAll() {
      setLoading(true);
      const [aRes, gRes] = await Promise.all([
        sb
          .from("anime")
          .select("*, anime_genres(genres(id, name))")
          .order("id", { ascending: false })
          .limit(300),
        sb.from("genres").select("id, name").order("name"),
      ]);
      if (ignore) return;
      setAnime((aRes.data as unknown as AnimeRow[]) ?? []);
      setGenres((gRes.data as unknown as GenreRow[]) ?? []);
      setLoading(false);
    }
    fetchAll();
    return () => {
      ignore = true;
    };
  }, [sb]);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm());
    setError("");
  };

  const openEdit = (a: AnimeRow) => {
    setCreating(false);
    setEditing(a);
    setError("");
    setForm({
      title: a.title,
      romaji: a.romaji ?? "",
      description: a.description ?? "",
      banner_image: a.banner_image ?? "",
      cover_image: a.cover_image ?? "",
      format: a.format,
      status: a.status,
      season_year: a.season_year ? String(a.season_year) : "",
      episodes_count: String(a.episodes_count ?? 0),
      duration: a.duration ? String(a.duration) : "",
      average_score: a.average_score ? String(a.average_score) : "",
      age_rating: a.age_rating,
      quality: a.quality,
      is_dub: a.is_dub,
      is_new: a.is_new,
      is_trending: a.is_trending,
      is_top: a.is_top,
      top_position: a.top_position ? String(a.top_position) : "",
      trailer_url: a.trailer_url ?? "",
      completed: Boolean(a.completed),
      is_active: a.is_active !== false,
      genres: (a.anime_genres ?? [])
        .map((g) => g.genres?.id)
        .filter((n): n is number => Boolean(n)),
    });
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleGenre = (id: number) =>
    setForm((f) => ({
      ...f,
      genres: f.genres.includes(id)
        ? f.genres.filter((g) => g !== id)
        : [...f.genres, id],
    }));

  const save = async () => {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");

    const row = {
      title: form.title.trim(),
      romaji: form.romaji.trim() || null,
      description: form.description.trim() || null,
      banner_image: form.banner_image.trim() || null,
      cover_image: form.cover_image.trim() || null,
      format: form.format,
      status: form.status,
      season_year: form.season_year ? Number(form.season_year) : null,
      episodes_count: Number(form.episodes_count) || 0,
      duration: form.duration ? Number(form.duration) : null,
      average_score: form.average_score ? Number(form.average_score) : null,
      age_rating: form.age_rating,
      quality: form.quality,
      is_dub: form.is_dub,
      is_new: form.is_new,
      is_trending: form.is_trending,
      is_top: form.is_top,
      top_position: form.top_position ? Number(form.top_position) : null,
      trailer_url: form.trailer_url.trim() || null,
      completed: form.completed,
      is_active: form.is_active,
    };

    if (editing) {
      const { error: upErr } = await sb
        .from("anime")
        .update(row)
        .eq("id", editing.id);
      if (upErr) {
        setError(upErr.message);
        setSaving(false);
        return;
      }
      await sb.from("anime_genres").delete().eq("anime_id", editing.id);
      if (form.genres.length) {
        await sb
          .from("anime_genres")
          .insert(form.genres.map((genre_id) => ({ anime_id: editing.id, genre_id })));
      }
    } else {
      const slug = `${slugify(form.title) || "anime"}-${Math.floor(Math.random() * 10000)}`;
      const { data, error: insErr } = await sb
        .from("anime")
        .insert({ ...row, slug })
        .select("id")
        .single();
      if (insErr || !data) {
        setError(insErr?.message ?? "Insert failed");
        setSaving(false);
        return;
      }
      if (form.genres.length) {
        await sb
          .from("anime_genres")
          .insert(form.genres.map((genre_id) => ({ anime_id: data.id, genre_id })));
      }
      for (const secSlug of ["new-series", "new-anime"]) {
        const { data: secData } = await sb
          .from("sections")
          .select("id")
          .eq("slug", secSlug)
          .single();
        if (!secData) continue;
        const { data: secItems } = await sb
          .from("section_items")
          .select("position")
          .eq("section_id", (secData as { id: number }).id);
        const positions = ((secItems ?? []) as { position: number }[]).map(
          (r) => r.position ?? 0
        );
        const nextPos = positions.length ? Math.min(...positions) - 1 : 1;
        await sb.from("section_items").insert({
          section_id: (secData as { id: number }).id,
          anime_id: data.id,
          position: nextPos,
        });
      }
    }

    setSaving(false);
    setCreating(false);
    setEditing(null);
    await load();
  };

  const remove = async (a: AnimeRow) => {
    if (!window.confirm(`Delete "${a.title}" and all its episodes?`)) return;
    const { error: delErr } = await sb.from("anime").delete().eq("id", a.id);
    if (delErr) window.alert(delErr.message);
    else await load();
  };

  const quickToggleCompleted = async (a: AnimeRow) => {
    const next = !a.completed;
    setAnime((prev) => prev.map((x) => (x.id === a.id ? { ...x, completed: next } : x)));
    const { error } = await sb.from("anime").update({ completed: next }).eq("id", a.id);
    if (error) {
      setAnime((prev) => prev.map((x) => (x.id === a.id ? { ...x, completed: a.completed } : x)));
      window.alert("Unable to update completed status. Please try again.");
    }
  };

  // Show/hide a title on the public website. Optimistic: flip the row right
  // away and roll back with an alert if the write fails.
  const quickToggleActive = async (a: AnimeRow) => {
    const next = a.is_active === false;
    setAnime((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_active: next } : x)));
    const { error } = await sb.from("anime").update({ is_active: next }).eq("id", a.id);
    if (error) {
      setAnime((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_active: a.is_active } : x)));
      window.alert("Unable to update website visibility. Please try again.");
    }
  };

  const filtered = anime.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase())
  );

  const label = (a: AnimeRow) =>
    a.id
      ? `${a.id} — ${a.title}`
      : a.title;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anime..."
          className={`${inputCls} max-w-xs`}
        />
        <Button onClick={openCreate}>+ Add Anime</Button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Anime</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Thumb src={a.cover_image} alt={a.title} />
                      <div className="min-w-0">
                        <p className="max-w-[300px] truncate font-bold text-white">{label(a)}</p>
                        <p className="max-w-[300px] truncate text-xs text-muted">
                          {(a.anime_genres ?? [])
                            .map((g) => g.genres?.name)
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/80">{a.format}</td>
                  <td className="px-4 py-3">
                    <StatusPill ok={a.status === "RELEASING"} text={a.status} />
                  </td>
                  <td className="px-4 py-3 text-white/80">{a.average_score ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {a.is_active === false && (
                        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          Hidden
                        </span>
                      )}
                      {a.completed && <StatusPill ok text="Completed" />}
                      {a.is_trending && <StatusPill ok text="Trending" />}
                      {a.is_top && <StatusPill ok text={`Top ${a.top_position ?? ""}`} />}
                      {a.is_new && <StatusPill ok text="New" />}
                      <button
                        onClick={() => quickToggleActive(a)}
                        title={a.is_active === false ? "Show on the website" : "Hide from the website"}
                        className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                          a.is_active === false
                            ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                            : "bg-white/5 text-muted hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {a.is_active === false ? "○ Off" : "● On"}
                      </button>
                      <button
                        onClick={() => quickToggleCompleted(a)}
                        title={a.completed ? "Mark as not completed" : "Mark as completed"}
                        className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                          a.completed
                            ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                            : "bg-white/5 text-muted hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {a.completed ? "✓ Completed" : "○ Completed"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" className="px-2.5 py-1" onClick={() => setEpisodesFor(a)}>
                        Episodes
                      </Button>
                      <Button variant="ghost" className="px-2.5 py-1" onClick={() => openEdit(a)}>
                        Edit
                      </Button>
                      <Button variant="danger" className="px-2.5 py-1" onClick={() => remove(a)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No anime found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <Modal
          title={editing ? `Edit — ${editing.title}` : "Add Anime"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          wide
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Title *" className="md:col-span-2">
              <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Romaji">
              <input className={inputCls} value={form.romaji} onChange={(e) => set("romaji", e.target.value)} />
            </Field>
            <Field label="Trailer URL">
              <input className={inputCls} value={form.trailer_url} onChange={(e) => set("trailer_url", e.target.value)} />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <textarea
                rows={4}
                className={inputCls}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <Field label="Cover image URL">
              <div className="flex gap-2">
                <input className={inputCls} value={form.cover_image} onChange={(e) => set("cover_image", e.target.value)} placeholder="https://..." />
                <Button variant="ghost" className="shrink-0" onClick={() => setTmdbFor("cover")}>
                  Search TMDB
                </Button>
              </div>
            </Field>
            <Field label="Banner image URL">
              <div className="flex gap-2">
                <input className={inputCls} value={form.banner_image} onChange={(e) => set("banner_image", e.target.value)} placeholder="https://..." />
                <Button variant="ghost" className="shrink-0" onClick={() => setTmdbFor("banner")}>
                  Search TMDB
                </Button>
              </div>
            </Field>
            <Field label="Format">
              <select className={inputCls} value={form.format} onChange={(e) => set("format", e.target.value)}>
                {["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "TV_SHORT", "MUSIC", "OTHER"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
                {["FINISHED", "RELEASING", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Season year">
              <input className={inputCls} value={form.season_year} onChange={(e) => set("season_year", e.target.value)} />
            </Field>
            <Field label="Episodes count">
              <input type="number" className={inputCls} value={form.episodes_count} onChange={(e) => set("episodes_count", e.target.value)} />
            </Field>
            <Field label="Duration (mins)">
              <input type="number" className={inputCls} value={form.duration} onChange={(e) => set("duration", e.target.value)} />
            </Field>
            <Field label="Average score">
              <input className={inputCls} value={form.average_score} onChange={(e) => set("average_score", e.target.value)} />
              <p className="mt-1.5 text-[11px] font-medium text-muted">
                Enter either 0–10 (e.g. 8.5) or 0–100 (e.g. 85). Both display correctly.
              </p>
            </Field>
            <Field label="Age rating">
              <select className={inputCls} value={form.age_rating} onChange={(e) => set("age_rating", e.target.value)}>
                {["G", "PG", "PG-13", "R", "NC-17"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Quality badge">
              <select className={inputCls} value={form.quality} onChange={(e) => set("quality", e.target.value)}>
                {["HD", "FHD", "4K", "SUB"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Top position">
              <input type="number" className={inputCls} value={form.top_position} onChange={(e) => set("top_position", e.target.value)} />
            </Field>
          </div>

          <Field label="Website visibility" className="mt-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-ink px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-white">
                  Visible on website {form.is_active ? <span className="text-emerald-300">· ON</span> : <span className="text-amber-300">· OFF</span>}
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  Turn OFF to hide this anime from the homepage, search and its own pages.
                  It stays listed here so you can turn it back on any time.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.is_active}
                aria-label="Visible on website"
                onClick={() => set("is_active", !form.is_active)}
                className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 ${
                  form.is_active
                    ? "border-emerald-400/50 bg-emerald-500"
                    : "border-white/15 bg-white/10"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
                    form.is_active ? "left-[26px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </Field>

          <Field label="Completed" className="mt-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-ink px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-white">
                  Completed {form.completed ? <span className="text-emerald-300">· ON</span> : <span className="text-muted">· OFF</span>}
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  Show the Completed badge on this anime when all available episodes have been uploaded.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.completed}
                onClick={() => set("completed", !form.completed)}
                className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 ${
                  form.completed
                    ? "border-emerald-400/50 bg-emerald-500"
                    : "border-white/15 bg-white/10"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
                    form.completed ? "left-[26px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </Field>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["is_dub", "Dubbed"],
              ["is_new", "New badge"],
              ["is_trending", "Trending"],
              ["is_top", "Top 10 list"],
            ].map(([key, text]) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink px-3 py-2 text-[13px] font-semibold text-white">
                <input
                  type="checkbox"
                  checked={Boolean(form[key as keyof FormState])}
                  onChange={(e) => set(key as keyof FormState, e.target.checked as never)}
                  className="accent-[#7b61ff]"
                />
                {text}
              </label>
            ))}
          </div>

          <Field label="Genres" className="mt-4">
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGenre(g.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    form.genres.includes(g.id)
                      ? "border-primary bg-primary/20 text-white"
                      : "border-white/10 bg-ink text-muted hover:border-primary/50"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </Field>

          {error && (
            <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Anime"}
            </Button>
          </div>
        </Modal>
      )}

      {episodesFor && (
        <EpisodesManager anime={episodesFor} onClose={() => setEpisodesFor(null)} />
      )}

      {tmdbFor && (
        <TmdbPicker
          mode="form"
          target={tmdbFor}
          onSelect={(img: TmdbSelectedImage) => {
            set(tmdbFor === "cover" ? "cover_image" : "banner_image", img.url);
            setTmdbFor(null);
          }}
          onClose={() => setTmdbFor(null)}
        />
      )}
    </div>
  );
}
