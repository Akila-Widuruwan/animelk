"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Field, Modal, Thumb, inputCls } from "./ui";

interface SectionRow {
  id: number;
  slug: string;
  title: string;
  kind: string;
  panel: boolean;
  view_all_url: string | null;
  sort_order: number;
  section_items: { position: number; anime: { id: number; title: string; cover_image: string | null } | null }[];
}

interface AnimePick {
  id: number;
  title: string;
  cover_image: string | null;
}

export default function SectionsManager() {
  const sb = supabaseBrowser();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [pool, setPool] = useState<AnimePick[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [editingSection, setEditingSection] = useState<SectionRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [sRes, aRes] = await Promise.all([
      sb
        .from("sections")
        .select("*, section_items(position, anime(id, title, cover_image))")
        .order("sort_order"),
      sb.from("anime").select("id, title, cover_image").order("title").limit(500),
    ]);
    setSections((sRes.data as unknown as SectionRow[]) ?? []);
    setPool((aRes.data as unknown as AnimePick[]) ?? []);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    let ignore = false;
    async function fetchAll() {
      const [sRes, aRes] = await Promise.all([
        sb
          .from("sections")
          .select("*, section_items(position, anime(id, title, cover_image))")
          .order("sort_order"),
        sb.from("anime").select("id, title, cover_image").order("title").limit(500),
      ]);
      if (ignore) return;
      setSections((sRes.data as unknown as SectionRow[]) ?? []);
      setPool((aRes.data as unknown as AnimePick[]) ?? []);
      setLoading(false);
    }
    fetchAll();
    return () => {
      ignore = true;
    };
  }, [sb]);

  const addItem = async (sectionId: number, animeId: number) => {
    setBusy(true);
    const { data } = await sb
      .from("section_items")
      .select("position")
      .eq("section_id", sectionId);
    const positions = (data ?? []).map((r: { position: number }) => r.position);
    const next = positions.length ? Math.max(...positions) + 1 : 1;
    await sb
      .from("section_items")
      .upsert({ section_id: sectionId, anime_id: animeId, position: next });
    setBusy(false);
    await load();
  };

  const removeItem = async (sectionId: number, animeId: number) => {
    await sb
      .from("section_items")
      .delete()
      .eq("section_id", sectionId)
      .eq("anime_id", animeId);
    await load();
  };

  const move = async (section: SectionRow, index: number, dir: -1 | 1) => {
    const items = [...section.section_items].sort((a, b) => a.position - b.position);
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    const { error } = await sb.from("section_items").upsert(
      items.map((it, i) => ({
        section_id: section.id,
        anime_id: it.anime?.id,
        position: i + 1,
      }))
    );
    if (error) window.alert(error.message);
    else await load();
  };

  const saveSection = async () => {
    if (!editingSection) return;
    setBusy(true);
    const res = editingSection.id
      ? await sb
          .from("sections")
          .update({
            title: editingSection.title,
            kind: editingSection.kind,
            panel: editingSection.panel,
            view_all_url: editingSection.view_all_url,
          })
          .eq("id", editingSection.id)
      : await sb
          .from("sections")
          .insert({
            slug: editingSection.slug || `section-${Date.now()}`,
            title: editingSection.title,
            kind: editingSection.kind,
            panel: editingSection.panel,
            view_all_url: editingSection.view_all_url,
            sort_order: sections.length + 1,
          });
    setBusy(false);
    if (res.error) window.alert(res.error.message);
    else {
      setEditingSection(null);
      setAdding(false);
      await load();
    }
  };

  const removeSection = async (s: SectionRow) => {
    if (!window.confirm(`Delete section "${s.title}"? Its items will be removed too.`)) return;
    await sb.from("sections").delete().eq("id", s.id);
    await load();
  };

  if (loading) return <p className="py-10 text-center text-sm text-muted">Loading...</p>;

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Button
          onClick={() => {
            setAdding(true);
            setEditingSection({
              id: 0,
              slug: "",
              title: "",
              kind: "carousel",
              panel: false,
              view_all_url: "#",
              sort_order: sections.length + 1,
              section_items: [],
            });
          }}
        >
          + Add Section
        </Button>
      </div>

      <div className="space-y-3">
        {sections.map((s) => {
          const items = [...s.section_items]
            .filter((it) => it.anime)
            .sort((a, b) => a.position - b.position);
          return (
            <div key={s.id} className="rounded-xl border border-white/10 bg-panel/50">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button
                  className="flex-1 text-left"
                  onClick={() => setOpenId(openId === s.id ? null : s.id)}
                >
                  <span className="text-[14px] font-bold text-white">{s.title}</span>
                  <span className="ml-2 rounded bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                    {s.kind}
                  </span>
                </button>
                <span className="text-xs text-muted">{items.length} items</span>
                <Button variant="ghost" className="px-2.5 py-1" onClick={() => setEditingSection(s)}>
                  Edit
                </Button>
                <Button variant="danger" className="px-2.5 py-1" onClick={() => removeSection(s)}>
                  Delete
                </Button>
              </div>

              {openId === s.id && (
                <div className="border-t border-white/5 p-4">
                  <div className="mb-4 flex gap-2">
                    <input
                      value={pickerQuery}
                      onChange={(e) => setPickerQuery(e.target.value)}
                      placeholder="Search anime to add..."
                      className={`${inputCls} max-w-xs`}
                    />
                    {pickerQuery && (
                      <div className="flex max-h-40 w-full max-w-sm flex-col gap-1 overflow-y-auto rounded-lg border border-white/10 bg-ink p-2">
                        {pool
                          .filter((a) =>
                            a.title.toLowerCase().includes(pickerQuery.toLowerCase())
                          )
                          .slice(0, 8)
                          .map((a) => (
                            <button
                              key={a.id}
                              disabled={busy}
                              onClick={() => addItem(s.id, a.id)}
                              className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-white/80 hover:bg-primary/20 hover:text-white"
                            >
                              <Thumb src={a.cover_image} alt={a.title} className="h-8 w-6" />
                              <span className="truncate">{a.title}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {items.map((it, i) => (
                      <div
                        key={it.anime!.id}
                        className="flex items-center gap-3 rounded-lg border border-white/5 bg-ink px-3 py-2"
                      >
                        <Thumb src={it.anime!.cover_image} alt={it.anime!.title} className="h-9 w-7" />
                        <span className="flex-1 truncate text-[13px] text-white">{it.anime!.title}</span>
                        <Button variant="ghost" className="px-2 py-1" onClick={() => move(s, i, -1)} disabled={i === 0}>
                          ↑
                        </Button>
                        <Button variant="ghost" className="px-2 py-1" onClick={() => move(s, i, 1)} disabled={i === items.length - 1}>
                          ↓
                        </Button>
                        <Button variant="danger" className="px-2 py-1" onClick={() => removeItem(s.id, it.anime!.id)}>
                          ✕
                        </Button>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <p className="py-4 text-center text-sm text-muted">
                        No items — search above to add anime
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(editingSection || adding) && (
        <Modal title={adding ? "Add Section" : "Edit Section"} onClose={() => { setEditingSection(null); setAdding(false); }}>
          <div className="space-y-4">
            <Field label="Title">
              <input
                className={inputCls}
                value={editingSection?.title ?? ""}
                onChange={(e) => setEditingSection((s) => (s ? { ...s, title: e.target.value } : s))}
              />
            </Field>
            <Field label="Layout kind">
              <select
                className={inputCls}
                value={editingSection?.kind ?? "carousel"}
                onChange={(e) => setEditingSection((s) => (s ? { ...s, kind: e.target.value } : s))}
              >
                {["carousel", "panel", "top10", "slider", "filter", "topics", "grid"].map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </Field>
            <Field label="View all URL">
              <input
                className={inputCls}
                value={editingSection?.view_all_url ?? "#"}
                onChange={(e) => setEditingSection((s) => (s ? { ...s, view_all_url: e.target.value } : s))}
              />
            </Field>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-white">
              <input
                type="checkbox"
                className="accent-[#7b61ff]"
                checked={Boolean(editingSection?.panel)}
                onChange={(e) => setEditingSection((s) => (s ? { ...s, panel: e.target.checked } : s))}
              />
              Show inside highlighted panel
            </label>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setEditingSection(null); setAdding(false); }}>
                Cancel
              </Button>
              <Button onClick={saveSection} disabled={busy}>
                {busy ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
