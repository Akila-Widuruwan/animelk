"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Field, Thumb, inputCls } from "./ui";

interface TopicRow {
  id: number;
  name: string;
  slug: string;
  color: string;
  image_url: string | null;
  sort_order: number;
}

export default function TopicsManager() {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb.from("topics").select("*").order("sort_order");
    setRows((data as unknown as TopicRow[]) ?? []);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    let ignore = false;
    async function fetchAll() {
      const { data } = await sb.from("topics").select("*").order("sort_order");
      if (ignore) return;
      setRows((data as unknown as TopicRow[]) ?? []);
      setLoading(false);
    }
    fetchAll();
    return () => {
      ignore = true;
    };
  }, [sb]);

  const update = (id: number, patch: Partial<TopicRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (r: TopicRow) => {
    setSavingId(r.id);
    const { error } = await sb
      .from("topics")
      .update({ name: r.name, color: r.color, image_url: r.image_url })
      .eq("id", r.id);
    setSavingId(null);
    if (error) window.alert(error.message);
  };

  const add = async () => {
    const { data, error } = await sb
      .from("topics")
      .insert({
        name: "New Topic",
        slug: `topic-${Date.now()}`,
        color: "#7b61ff",
        image_url: null,
        sort_order: rows.length + 1,
      })
      .select()
      .single();
    if (error) window.alert(error.message);
    else setRows((rs) => [...rs, data as unknown as TopicRow]);
  };

  const remove = async (r: TopicRow) => {
    if (!window.confirm(`Delete topic "${r.name}"?`)) return;
    await sb.from("topics").delete().eq("id", r.id);
    await load();
  };

  if (loading) return <p className="py-10 text-center text-sm text-muted">Loading...</p>;

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Button onClick={add}>+ Add Topic</Button>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-panel/50 px-4 py-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-extrabold text-white"
              style={{ background: r.color }}
            >
              {r.name.slice(0, 1).toUpperCase()}
            </span>
            <Field label="Name" className="w-44">
              <input className={inputCls} value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
            </Field>
            <Field label="Color" className="w-24">
              <input
                type="color"
                className="h-[38px] w-full cursor-pointer rounded-lg border border-white/10 bg-ink p-1"
                value={r.color}
                onChange={(e) => update(r.id, { color: e.target.value })}
              />
            </Field>
            <Field label="Image URL" className="min-w-[240px] flex-1">
              <input
                className={inputCls}
                value={r.image_url ?? ""}
                placeholder="https://..."
                onChange={(e) => update(r.id, { image_url: e.target.value })}
              />
            </Field>
            <Thumb src={r.image_url} alt={r.name} className="h-10 w-10" />
            <Button onClick={() => save(r)} disabled={savingId === r.id}>
              {savingId === r.id ? "Saving..." : "Save"}
            </Button>
            <Button variant="danger" onClick={() => remove(r)}>
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
