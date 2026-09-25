"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Field, inputCls } from "./ui";

interface MenuRow {
  id: number;
  label: string;
  href: string;
  badge: string | null;
  has_dropdown: boolean;
  sort_order: number;
}

export default function MenuManager() {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<MenuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb.from("menu_items").select("*").order("sort_order");
    setRows((data as unknown as MenuRow[]) ?? []);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    let ignore = false;
    async function fetchAll() {
      const { data } = await sb.from("menu_items").select("*").order("sort_order");
      if (ignore) return;
      setRows((data as unknown as MenuRow[]) ?? []);
      setLoading(false);
    }
    fetchAll();
    return () => {
      ignore = true;
    };
  }, [sb]);

  const update = (id: number, patch: Partial<MenuRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (r: MenuRow) => {
    setSavingId(r.id);
    const { error } = await sb
      .from("menu_items")
      .update({
        label: r.label,
        href: r.href,
        badge: r.badge,
        has_dropdown: r.has_dropdown,
      })
      .eq("id", r.id);
    setSavingId(null);
    if (error) window.alert(error.message);
  };

  const add = async () => {
    const { data, error } = await sb
      .from("menu_items")
      .insert({
        label: "New Item",
        href: "/#",
        badge: null,
        has_dropdown: false,
        sort_order: rows.length + 1,
      })
      .select()
      .single();
    if (error) window.alert(error.message);
    else setRows((rs) => [...rs, data as unknown as MenuRow]);
  };

  const remove = async (r: MenuRow) => {
    if (!window.confirm(`Remove menu item "${r.label}"?`)) return;
    await sb.from("menu_items").delete().eq("id", r.id);
    await load();
  };

  if (loading) return <p className="py-10 text-center text-sm text-muted">Loading...</p>;

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Button onClick={add}>+ Add Item</Button>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-panel/50 px-4 py-3">
            <Field label="Label" className="w-36">
              <input className={inputCls} value={r.label} onChange={(e) => update(r.id, { label: e.target.value })} />
            </Field>
            <Field label="Link" className="min-w-[180px] flex-1">
              <input className={inputCls} value={r.href} onChange={(e) => update(r.id, { href: e.target.value })} />
            </Field>
            <Field label="Badge" className="w-24">
              <input
                className={inputCls}
                value={r.badge ?? ""}
                placeholder="New"
                onChange={(e) => update(r.id, { badge: e.target.value || null })}
              />
            </Field>
            <label className="flex items-center gap-2 pt-5 text-[13px] font-semibold text-white">
              <input
                type="checkbox"
                className="accent-[#7b61ff]"
                checked={r.has_dropdown}
                onChange={(e) => update(r.id, { has_dropdown: e.target.checked })}
              />
              Dropdown
            </label>
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
