"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Field, inputCls } from "./ui";

interface TmdbConfig {
  api_key?: string;
  access_token?: string;
}

export default function TmdbSettings() {
  const sb = supabaseBrowser();
  const [apiKey, setApiKey] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data } = await sb.from("settings").select("value").eq("key", "tmdb_api").single();
      if (ignore) return;
      const cfg = (data as { value?: TmdbConfig } | null)?.value ?? {};
      setApiKey(cfg.api_key ?? "");
      setAccessToken(cfg.access_token ?? "");
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, [sb]);

  const save = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    const payload: TmdbConfig = {
      api_key: apiKey.trim(),
      access_token: accessToken.trim(),
    };
    const { error: upErr } = await sb.from("settings").upsert(
      { key: "tmdb_api", value: payload },
      { onConflict: "key" }
    );
    setBusy(false);
    if (upErr) setError(upErr.message);
    else setSaved(true);
  };

  if (loading) return null;

  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-panel/60 p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">TMDB API</h3>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </Button>
      </div>
      <p className="mb-4 text-[12px] text-muted">
        Powers the <b className="text-white">TMDB Images</b> search in the admin. Get the key at{" "}
        <b className="text-white">themoviedb.org/settings/api</b>. The keys are stored in your site
        settings and only used server-side — never sent to the browser.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="API key (v3)">
          <input
            type="password"
            className={inputCls}
            placeholder="Your TMDB API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Field>
        <Field label="Read access token (v4, optional)">
          <input
            type="password"
            className={inputCls}
            placeholder="Your TMDB read access token"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
          />
        </Field>
      </div>
      <p className="mt-3 text-[12px] text-muted">
        Either key works — if both are filled, the read access token is used. You can also set
        them as server environment variables (<code className="text-white">TMDB_API_KEY</code> /{" "}
        <code className="text-white">TMDB_ACCESS_TOKEN</code>) instead; those take priority.
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>}
      {saved && <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">Saved.</p>}
    </div>
  );
}
