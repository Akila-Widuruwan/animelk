"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Field, Modal, StatusPill, inputCls } from "./ui";

interface EpisodeRow {
  id: number;
  episode_number: number;
  title: string | null;
  video_url: string | null;
  thumbnail: string | null;
  duration: number | null;
  is_premium: boolean;
}

interface Props {
  anime: { id: number; title: string };
  onClose: () => void;
}

export default function EpisodesManager({ anime, onClose }: Props) {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<EpisodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<EpisodeRow> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await sb
      .from("episodes")
      .select("*")
      .eq("anime_id", anime.id)
      .order("episode_number");
    setRows((data as unknown as EpisodeRow[]) ?? []);
    setLoading(false);
  }, [sb, anime.id]);

  useEffect(() => {
    let ignore = false;
    async function fetchAll() {
      const { data } = await sb
        .from("episodes")
        .select("*")
        .eq("anime_id", anime.id)
        .order("episode_number");
      if (ignore) return;
      setRows((data as unknown as EpisodeRow[]) ?? []);
      setLoading(false);
    }
    fetchAll();
    return () => {
      ignore = true;
    };
  }, [sb, anime.id]);

  const openAdd = () =>
    setEditing({
      episode_number: rows.length ? Math.max(...rows.map((r) => r.episode_number)) + 1 : 1,
      title: "",
      video_url: "",
      thumbnail: "",
      duration: null,
      is_premium: false,
    });

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError("");
    const payload = {
      episode_number: Number(editing.episode_number),
      title: editing.title?.trim() || null,
      video_url: editing.video_url?.trim() || null,
      thumbnail: editing.thumbnail?.trim() || null,
      duration: editing.duration ? Number(editing.duration) : null,
      is_premium: Boolean(editing.is_premium),
    };
    const res = editing.id
      ? await sb.from("episodes").update(payload).eq("id", editing.id)
      : await sb.from("episodes").insert({ ...payload, anime_id: anime.id });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setEditing(null);
    await load();
  };

  const remove = async (r: EpisodeRow) => {
    if (!window.confirm(`Delete episode ${r.episode_number}?`)) return;
    const { error: delErr } = await sb.from("episodes").delete().eq("id", r.id);
    if (delErr) window.alert(delErr.message);
    else await load();
  };

  return (
    <Modal title={`Episodes — ${anime.title}`} onClose={onClose} wide>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] text-muted">
          {rows.length} episode{rows.length === 1 ? "" : "s"}
        </p>
        <Button onClick={openAdd}>+ Add Episode</Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Loading...</p>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-panel text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Video URL</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Premium</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-4 py-2.5 font-bold text-white">{r.episode_number}</td>
                  <td className="px-4 py-2.5 text-white/80">{r.title ?? "—"}</td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-muted">
                    {r.video_url ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-white/80">{r.duration ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill ok={r.is_premium} text={r.is_premium ? "Yes" : "No"} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" className="px-2.5 py-1" onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                      <Button variant="danger" className="px-2.5 py-1" onClick={() => remove(r)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No episodes yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="mt-5 rounded-xl border border-white/10 bg-ink p-4">
          <h4 className="mb-4 text-sm font-bold text-white">
            {editing.id ? "Edit Episode" : "Add Episode"}
          </h4>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Number *">
              <input
                type="number"
                className={inputCls}
                value={editing.episode_number ?? ""}
                onChange={(e) => setEditing({ ...editing, episode_number: Number(e.target.value) })}
              />
            </Field>
            <Field label="Title">
              <input
                className={inputCls}
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </Field>
            <Field label="Duration (mins)">
              <input
                type="number"
                className={inputCls}
                value={editing.duration ?? ""}
                onChange={(e) => setEditing({ ...editing, duration: Number(e.target.value) })}
              />
            </Field>
            <Field label="Premium">
              <label className="flex h-[38px] items-center gap-2 rounded-lg border border-white/10 bg-ink px-3 text-[13px] font-semibold text-white">
                <input
                  type="checkbox"
                  className="accent-[#7b61ff]"
                  checked={Boolean(editing.is_premium)}
                  onChange={(e) => setEditing({ ...editing, is_premium: e.target.checked })}
                />
                Premium only
              </label>
            </Field>
            <Field label="Video URL" className="col-span-2 md:col-span-4">
              <input
                className={inputCls}
                value={editing.video_url ?? ""}
                placeholder="https://... mp4 / m3u8 / embed URL"
                onChange={(e) => setEditing({ ...editing, video_url: e.target.value })}
              />
            </Field>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
