"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Field, Modal, Thumb, inputCls } from "@/components/admin/ui";
import EpisodesManager from "@/components/admin/EpisodesManager";
import TmdbPicker, { type TmdbSelectedImage } from "@/components/admin/TmdbPicker";

interface Submission {
  id: number;
  title: string;
  romaji: string | null;
  description: string | null;
  banner_image: string | null;
  cover_image: string | null;
  format: string;
  status: string;
  season: string | null;
  season_year: number | null;
  episodes_count: number;
  duration: number | null;
  average_score: number | null;
  age_rating: string;
  quality: string;
  is_dub: boolean;
  trailer_url: string | null;
  completed: boolean;
  moderation_status: "pending" | "approved" | "rejected";
  review_note: string | null;
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
  season: string;
  season_year: string;
  episodes_count: string;
  duration: string;
  average_score: string;
  age_rating: string;
  quality: string;
  is_dub: boolean;
  trailer_url: string;
  completed: boolean;
  genres: number[];
}

const emptyForm = (): FormState => ({
  title: "",
  romaji: "",
  description: "",
  banner_image: "",
  cover_image: "",
  format: "TV",
  status: "RELEASING",
  season: "",
  season_year: String(new Date().getFullYear()),
  episodes_count: "0",
  duration: "",
  average_score: "",
  age_rating: "PG-13",
  quality: "HD",
  is_dub: false,
  trailer_url: "",
  completed: false,
  genres: [],
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const STATUS_STYLE: Record<Submission["moderation_status"], string> = {
  pending: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-red-500/15 text-red-300",
};

export default function StaffSubmissions() {
  const sb = supabaseBrowser();
  const [uid, setUid] = useState<string | null>(null);
  const [rows, setRows] = useState<Submission[]>([]);
  const [genres, setGenres] = useState<GenreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Submission | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [episodesFor, setEpisodesFor] = useState<{ id: number; title: string } | null>(null);
  const [tmdbFor, setTmdbFor] = useState<"cover" | "banner" | null>(null);

  const load = useCallback(async () => {
    const [aRes, gRes] = await Promise.all([
      sb
        .from("anime")
        .select(
          "id, title, romaji, description, banner_image, cover_image, format, status, season, season_year, episodes_count, duration, average_score, age_rating, quality, is_dub, trailer_url, completed, moderation_status, review_note, anime_genres(genres(id, name))"
        )
        .order("id", { ascending: false })
        .limit(300),
      sb.from("genres").select("id, name").order("name"),
    ]);
    setRows((aRes.data as unknown as Submission[]) ?? []);
    setGenres((gRes.data as unknown as GenreRow[]) ?? []);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data } = await sb.auth.getUser();
      if (ignore) return;
      setUid(data.user?.id ?? null);
      await load();
    })();
    return () => {
      ignore = true;
    };
  }, [sb, load]);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm());
    setError("");
  };

  const openEdit = (a: Submission) => {
    if (a.moderation_status !== "pending") return;
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
      season: a.season ?? "",
      season_year: a.season_year ? String(a.season_year) : "",
      episodes_count: String(a.episodes_count ?? 0),
      duration: a.duration ? String(a.duration) : "",
      average_score: a.average_score ? String(a.average_score) : "",
      age_rating: a.age_rating,
      quality: a.quality,
      is_dub: a.is_dub,
      trailer_url: a.trailer_url ?? "",
      completed: Boolean(a.completed),
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
    if (!uid) {
      setError("Not signed in.");
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
      season: form.season || null,
      season_year: form.season_year ? Number(form.season_year) : null,
      episodes_count: Number(form.episodes_count) || 0,
      duration: form.duration ? Number(form.duration) : null,
      average_score: form.average_score ? Number(form.average_score) : null,
      age_rating: form.age_rating,
      quality: form.quality,
      is_dub: form.is_dub,
      trailer_url: form.trailer_url.trim() || null,
      completed: form.completed,
    };

    let animeId: number;
    if (editing) {
      const { error: upErr } = await sb.from("anime").update(row).eq("id", editing.id);
      if (upErr) {
        setError(upErr.message);
        setSaving(false);
        return;
      }
      animeId = editing.id;
      await sb.from("anime_genres").delete().eq("anime_id", animeId);
    } else {
      const slug = `${slugify(form.title) || "anime"}-${Math.floor(Math.random() * 100000)}`;
      const { data, error: insErr } = await sb
        .from("anime")
        .insert({
          ...row,
          slug,
          submitted_by: uid,
          moderation_status: "pending",
        })
        .select("id")
        .single();
      if (insErr || !data) {
        setError(insErr?.message ?? "Submission failed");
        setSaving(false);
        return;
      }
      animeId = (data as { id: number }).id;
    }

    if (form.genres.length) {
      const { error: gErr } = await sb
        .from("anime_genres")
        .insert(form.genres.map((genre_id) => ({ anime_id: animeId, genre_id })));
      if (gErr) setError(`Saved anime, but genres failed: ${gErr.message}`);
    }

    setSaving(false);
    setCreating(false);
    setEditing(null);
    await load();
  };

  const filtered = rows.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search my submissions..."
          className={`${inputCls} max-w-xs`}
        />
        <Button onClick={openCreate}>+ Submit Anime</Button>
      </div>

      <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[12.5px] leading-6 text-amber-200/90">
        Your uploads are private until the owner approves them. You can keep editing
        a submission (metadata, images, episodes) while it is <b>Pending</b>; once
        approved it becomes part of the live site and is locked.
      </p>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Submission</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Episodes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const pending = a.moderation_status === "pending";
                return (
                  <tr key={a.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Thumb src={a.cover_image} alt={a.title} />
                        <div className="min-w-0">
                          <p className="max-w-[300px] truncate font-bold text-white">
                            {a.id} — {a.title}
                          </p>
                          <p className="max-w-[320px] truncate text-xs text-muted">
                            {(a.anime_genres ?? [])
                              .map((g) => g.genres?.name)
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                          {a.moderation_status === "rejected" && a.review_note && (
                            <p className="mt-0.5 max-w-[340px] text-xs text-red-300">
                              Owner: {a.review_note}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/80">{a.format}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-bold capitalize ${STATUS_STYLE[a.moderation_status]}`}
                      >
                        {a.moderation_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/80">{a.episodes_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          className="px-2.5 py-1"
                          disabled={!pending}
                          onClick={() =>
                            setEpisodesFor({ id: a.id, title: a.title })
                          }
                        >
                          Episodes
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2.5 py-1"
                          disabled={!pending}
                          onClick={() => openEdit(a)}
                        >
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    No submissions yet — use “Submit Anime” to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <Modal
          title={editing ? `Edit submission — ${editing.title}` : "Submit a new anime"}
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
            <Field label="Cover image URL (poster)">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={form.cover_image}
                  onChange={(e) => set("cover_image", e.target.value)}
                  placeholder="https://..."
                />
                <Button variant="ghost" className="shrink-0" onClick={() => setTmdbFor("cover")}>
                  TMDB
                </Button>
              </div>
            </Field>
            <Field label="Banner image URL (backdrop)">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={form.banner_image}
                  onChange={(e) => set("banner_image", e.target.value)}
                  placeholder="https://..."
                />
                <Button variant="ghost" className="shrink-0" onClick={() => setTmdbFor("banner")}>
                  TMDB
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
                {["RELEASING", "FINISHED", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Season">
              <select className={inputCls} value={form.season} onChange={(e) => set("season", e.target.value)}>
                <option value="">—</option>
                {["WINTER", "SPRING", "SUMMER", "FALL"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Season year">
              <input className={inputCls} value={form.season_year} onChange={(e) => set("season_year", e.target.value)} />
            </Field>
            <Field label="Episodes count">
              <input
                type="number"
                className={inputCls}
                value={form.episodes_count}
                onChange={(e) => set("episodes_count", e.target.value)}
              />
            </Field>
            <Field label="Duration (mins)">
              <input type="number" className={inputCls} value={form.duration} onChange={(e) => set("duration", e.target.value)} />
            </Field>
            <Field label="Average score">
              <input className={inputCls} value={form.average_score} onChange={(e) => set("average_score", e.target.value)} />
              <p className="mt-1.5 text-[11px] font-medium text-muted">
                Enter either 0–10 (e.g. 8.5) or 0–100 (e.g. 85).
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
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {([
              ["is_dub", "Dubbed"],
              ["completed", "Completed"],
            ] as const).map(([key, text]) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink px-3 py-2 text-[13px] font-semibold text-white"
              >
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={(e) => set(key, e.target.checked)}
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

          {!editing && (
            <p className="mt-4 rounded-lg border border-white/10 bg-ink px-3 py-2 text-[12px] leading-6 text-muted">
              Tip: submit the metadata first, then use <b className="text-white">Episodes</b> on the row
              to upload video URLs and subtitles.
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Submit for Review"}
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
