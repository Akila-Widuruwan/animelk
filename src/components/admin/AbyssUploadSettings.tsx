"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Field, inputCls } from "./ui";

interface AbyssUploadConfig {
  api_key?: string;
  api_endpoint?: string;
  session_cookie?: string;
}

export default function AbyssUploadSettings() {
  const sb = supabaseBrowser();
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("https://up.hydrax.net");
  const [sessionCookie, setSessionCookie] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data } = await sb.from("settings").select("value").eq("key", "abyss_upload").single();
      if (ignore) return;
      const cfg = (data as { value?: AbyssUploadConfig } | null)?.value ?? {};
      setApiKey(cfg.api_key ?? "");
      setEndpoint(cfg.api_endpoint ?? "https://up.hydrax.net");
      setSessionCookie(cfg.session_cookie ?? "");
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
    const payload: AbyssUploadConfig = {
      api_key: apiKey.trim(),
      api_endpoint: endpoint.trim() || "https://up.hydrax.net",
      session_cookie: sessionCookie.trim(),
    };
    const { error: upErr } = await sb.from("settings").upsert(
      { key: "abyss_upload", value: payload },
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
        <h3 className="text-sm font-bold text-white">Abyss.to Upload API</h3>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </Button>
      </div>
      <p className="mb-4 text-[12px] text-muted">
        API key for direct file uploads, and an optional dashboard session cookie that enables
        the <b className="text-white">instant remote upload</b> (abyss fetches the seedr link
        server-to-server — MKV works, no local download).
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="API key">
          <input
            type="password"
            className={inputCls}
            placeholder="Your abyss.to API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Field>
        <Field label="Upload base URL">
          <input
            className={inputCls}
            placeholder="https://up.hydrax.net"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
        </Field>
        <Field label="Session cookie (optional — for instant remote upload)" className="md:col-span-2">
          <input
            type="password"
            className={inputCls}
            placeholder="Paste your dash.abyss.to session cookie"
            value={sessionCookie}
            onChange={(e) => setSessionCookie(e.target.value)}
          />
        </Field>
      </div>
      <p className="mt-3 text-[12px] text-muted">
        How to get the cookie: log in to <b className="text-white">dash.abyss.to</b> → press F12 →
        Application → Cookies → dash.abyss.to → copy the <b className="text-white">session</b> cookie
        value (paste the whole value here). Without it, the admin falls back to downloading on the
        server and uploading the file with your API key.
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>}
      {saved && <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">Saved.</p>}
    </div>
  );
}


