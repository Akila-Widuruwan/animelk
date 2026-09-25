"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Field, inputCls } from "./ui";

interface SettingRow {
  key: string;
  value: Record<string, unknown>;
}

export default function SettingsManager() {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    async function fetchAll() {
      const { data } = await sb.from("settings").select("key, value").order("key");
      if (ignore) return;
      const list = (data as unknown as SettingRow[]) ?? [];
      setRows(list);
      setTexts(
        Object.fromEntries(
          list.map((r) => [r.key, JSON.stringify(r.value ?? {}, null, 2)])
        )
      );
      setLoading(false);
    }
    fetchAll();
    return () => {
      ignore = true;
    };
  }, [sb]);

  const save = async (key: string) => {
    setError("");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(texts[key]);
    } catch {
      setError(`"${key}" is not valid JSON`);
      return;
    }
    setSavingKey(key);
    const { error: upErr } = await sb
      .from("settings")
      .update({ value: parsed })
      .eq("key", key);
    setSavingKey(null);
    if (upErr) setError(upErr.message);
  };

  if (loading) return <p className="py-10 text-center text-sm text-muted">Loading...</p>;

  return (
    <div>
      <p className="mb-5 text-[13px] text-muted">
        Site-wide settings stored as JSON. Keys used by the site: <code>site</code>,{" "}
        <code>footer</code>, <code>socials</code>.
      </p>
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>
      )}
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.key} className="rounded-xl border border-white/5 bg-panel/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">{r.key}</h4>
              <Button onClick={() => save(r.key)} disabled={savingKey === r.key}>
                {savingKey === r.key ? "Saving..." : "Save"}
              </Button>
            </div>
            <Field label="JSON value">
              <textarea
                rows={8}
                spellCheck={false}
                className={`${inputCls} font-mono text-xs`}
                value={texts[r.key] ?? ""}
                onChange={(e) => setTexts((t) => ({ ...t, [r.key]: e.target.value }))}
              />
            </Field>
          </div>
        ))}
      </div>
    </div>
  );
}
