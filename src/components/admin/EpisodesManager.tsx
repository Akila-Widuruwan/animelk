"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { downloadNotebook } from "@/lib/hardsub-notebook";
import { buildTransferNotebook, buildTransferScript } from "@/lib/r2-notebook";
import { extractAbyssSlug, isAbyssUrl } from "@/lib/abyss-slug";
import { normalizeSubtitle, guessLangCode, safeSubtitleName } from "@/lib/subtitle";
import { pushSubtitleToAbyss, type AbyssSubtitleLanguage } from "@/lib/abyss-sub";
import { Button, Field, Modal, StatusPill, inputCls } from "./ui";

interface SubtitleRow {
  url?: string;
  label?: string;
  lang?: string;
  default?: boolean;
  filename?: string;
  abyssSlug?: string;
}

interface EpisodeRow {
  id: number;
  episode_number: number;
  title: string | null;
  video_url: string | null;
  thumbnail: string | null;
  duration: number | null;
  is_premium: boolean;
  subtitles?: SubtitleRow[];
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
  const [subLang, setSubLang] = useState("English");
  const [subBusy, setSubBusy] = useState(false);
  const [subMsg, setSubMsg] = useState("");
  const [subFiles, setSubFiles] = useState<Record<AbyssSubtitleLanguage, File | null>>({
    Sinhala: null,
    English: null,
  });
  const [subSteps, setSubSteps] = useState<{ label: string; ok: boolean }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [colabOpen, setColabOpen] = useState(false);
  const [colab, setColab] = useState<{
    url: string;
    filename: string;
    useR2: boolean;
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicUrl: string;
    useAbyss: boolean;
    abyssKey: string;
    abyssBase: string;
  }>({
    url: "",
    filename: "",
    useR2: true,
    accountId: "",
    accessKeyId: "",
    secretAccessKey: "",
    bucket: "animelk",
    publicUrl: "",
    useAbyss: false,
    abyssKey: "",
    abyssBase: "https://up.hydrax.net",
  });

  const openColabTransfer = async () => {
    let saved: Partial<typeof colab> = {};
    try {
      saved = JSON.parse(localStorage.getItem("animelk-r2-colab") || "{}");
    } catch {}
    // migrate stale saved prefs that point at the wrong abyss endpoint
    if (
      saved.abyssBase?.includes("api.abyss.to") ||
      saved.abyssBase?.includes("/api/upload/url") ||
      saved.abyssBase?.includes("up.abyss.to")
    ) {
      saved.abyssBase = "https://up.hydrax.net";
    }
    setColab((c) => ({ ...c, ...saved }));
    setColabOpen(true);

    const { data } = await sb
      .from("settings")
      .select("value")
      .eq("key", "abyss_upload")
      .single();
    const abyssCfg = (data as { value?: { api_key?: string; api_endpoint?: string } } | null)?.value;
    if (abyssCfg) {
      setColab((c) => ({
        ...c,
        abyssKey: c.abyssKey || abyssCfg.api_key || "",
        abyssBase:
          !c.abyssBase ||
          c.abyssBase.includes("api.abyss.to") ||
          c.abyssBase.includes("/api/upload/url") ||
          c.abyssBase.includes("up.abyss.to")
            ? abyssCfg.api_endpoint || "https://up.hydrax.net"
            : c.abyssBase,
      }));
    }
  };

  const saveColabPrefs = () => {
    try {
      const { url: _ignored, ...rest } = colab;
      void _ignored;
      localStorage.setItem("animelk-r2-colab", JSON.stringify(rest));
    } catch {}
  };

  const downloadColabTransfer = () => {
    if (!colab.url.trim()) {
      setError("Paste the direct video link first.");
      return;
    }
    if (!colab.useR2 && !colab.useAbyss) {
      setError("Tick at least one storage (R2 or abyss.to).");
      return;
    }
    if (
      colab.useR2 &&
      (!colab.accountId.trim() ||
        !colab.accessKeyId.trim() ||
        !colab.secretAccessKey.trim() ||
        !colab.publicUrl.trim())
    ) {
      setError("Fill in the R2 Account ID, Access Key ID, Secret Key and Public URL.");
      return;
    }
    if (colab.useAbyss && !colab.abyssKey.trim()) {
      setError("Fill in the abyss.to API key.");
      return;
    }
    setError("");
    saveColabPrefs();
    const ipynb = buildTransferNotebook({
      videoUrl: colab.url.trim(),
      filename: colab.filename.trim() || "video.mp4",
      r2: colab.useR2
        ? {
            accountId: colab.accountId.trim(),
            accessKeyId: colab.accessKeyId.trim(),
            secretAccessKey: colab.secretAccessKey.trim(),
            bucket: colab.bucket.trim() || "animelk",
            publicUrl: colab.publicUrl.trim(),
          }
        : null,
      abyss: colab.useAbyss
        ? {
            apiKey: colab.abyssKey.trim(),
            uploadBase: colab.abyssBase.trim() || "https://up.hydrax.net",
          }
        : null,
    });
    downloadNotebook(ipynb, `transfer-${colab.filename.trim() || "video"}.ipynb`);
  };

  const downloadLocalScript = () => {
    if (!colab.url.trim()) {
      setError("Paste the direct video link first.");
      return;
    }
    if (!colab.useR2 && !colab.useAbyss) {
      setError("Tick at least one storage (R2 or abyss.to).");
      return;
    }
    if (
      colab.useR2 &&
      (!colab.accountId.trim() ||
        !colab.accessKeyId.trim() ||
        !colab.secretAccessKey.trim() ||
        !colab.publicUrl.trim())
    ) {
      setError("Fill in the R2 Account ID, Access Key ID, Secret Key and Public URL.");
      return;
    }
    if (colab.useAbyss && !colab.abyssKey.trim()) {
      setError("Fill in the abyss.to API key.");
      return;
    }
    setError("");
    saveColabPrefs();
    const script = buildTransferScript({
      videoUrl: colab.url.trim(),
      filename: colab.filename.trim() || "video.mp4",
      r2: colab.useR2
        ? {
            accountId: colab.accountId.trim(),
            accessKeyId: colab.accessKeyId.trim(),
            secretAccessKey: colab.secretAccessKey.trim(),
            bucket: colab.bucket.trim() || "animelk",
            publicUrl: colab.publicUrl.trim(),
          }
        : null,
      abyss: colab.useAbyss
        ? {
            apiKey: colab.abyssKey.trim(),
            uploadBase: colab.abyssBase.trim() || "https://up.hydrax.net",
          }
        : null,
    });
    const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transfer-${colab.filename.trim() || "video"}.py`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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

  const resetSubUpload = () => {
    setSubFiles({ Sinhala: null, English: null });
    setSubSteps(null);
  };

  const openAdd = () => {
    resetSubUpload();
    setEditing({
      episode_number: rows.length ? Math.max(...rows.map((r) => r.episode_number)) + 1 : 1,
      title: "",
      video_url: "",
      thumbnail: "",
      duration: null,
      is_premium: false,
      subtitles: [],
    });
  };

  const uploadSubtitleFile = async (file: File) => {
    if (!editing) return;
    setSubBusy(true);
    setSubMsg("");
    setError("");
    try {
      const vtt = normalizeSubtitle(await file.text());
      const name = safeSubtitleName(file.name);
      const epNo = Number(editing.episode_number) || rows.length + 1;
      const path = `${anime.id}/ep${epNo}/${Date.now()}-${name}`;
      const { error: upErr } = await sb.storage
        .from("subtitles")
        .upload(path, new Blob([vtt], { type: "text/vtt" }), {
          contentType: "text/vtt",
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = sb.storage.from("subtitles").getPublicUrl(path);
      const tracks = editing.subtitles ?? [];
      const track: SubtitleRow = {
        url: pub.publicUrl,
        label: subLang.trim() || name,
        lang: guessLangCode(subLang),
        default: tracks.length === 0,
        filename: name,
      };
      setEditing({ ...editing, subtitles: [...tracks, track] });
      setSubMsg(`Added “${name}”${track.default ? " as the default track" : ""}. Save the episode to publish it.`);
    } catch (e) {
      setSubMsg(
        `Upload failed: ${e instanceof Error ? e.message : "unknown error"}. ` +
          "Check that the 'subtitles' storage bucket exists (run supabase/migrations/0006_subtitles.sql)."
      );
    } finally {
      setSubBusy(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError("");
    setSubMsg("");
    setSubSteps(null);
    const subs: SubtitleRow[] = (editing.subtitles ?? [])
      .map((s) => ({
        url: s.url?.trim() || "",
        label: s.label?.trim() || "",
        lang: s.lang?.trim() || "en",
        default: Boolean(s.default),
        ...(s.filename ? { filename: s.filename } : {}),
        ...(s.abyssSlug ? { abyssSlug: s.abyssSlug } : {}),
      }))
      .filter((s) => s.url);
    if (!subs.some((s) => s.default) && subs.length > 0) subs[0].default = true;

    const abyssId = extractAbyssSlug(editing.video_url ?? "");
    const payload = {
      episode_number: Number(editing.episode_number),
      title: editing.title?.trim() || null,
      video_url: editing.video_url?.trim() || null,
      thumbnail: editing.thumbnail?.trim() || null,
      duration: editing.duration ? Number(editing.duration) : null,
      is_premium: Boolean(editing.is_premium),
      subtitles: subs,
    };
    // 1) Save the episode first — a subtitle failure must never invalidate it.
    const res = editing.id
      ? await sb.from("episodes").update(payload).eq("id", editing.id)
      : await sb.from("episodes").insert({ ...payload, anime_id: anime.id });
    if (res.error) {
      setBusy(false);
      setError(res.error.message);
      return;
    }

    // 2) Attach subtitles to Abyss — only for abyss iframe episodes with a picked file.
    const steps: { label: string; ok: boolean }[] = [{ label: "Episode saved", ok: true }];
    if (abyssId) {
      steps.push({ label: `Abyss video detected (${abyssId})`, ok: true });
      for (const lang of ["Sinhala", "English"] as const) {
        const file = subFiles[lang];
        if (!file) continue;
        const out = await pushSubtitleToAbyss({ fileId: abyssId, language: lang, file });
        steps.push({
          label: out.ok
            ? `${lang} subtitle uploaded`
            : `${lang} subtitle upload failed${out.error ? ` — ${out.error}` : ""}`,
          ok: out.ok,
        });
      }
    }

    setBusy(false);
    setSubFiles({ Sinhala: null, English: null });
    setEditing(null);
    if (steps.length > 1) setSubSteps(steps);
    await load();
  };

  const abyssId = editing ? extractAbyssSlug(editing.video_url ?? "") : null;
  // Episode has at least one non-abyss (direct / HLS / archive) server, so the
  // on-site player needs its own WebVTT tracks on top of any abyss subtitles.
  const hasDirectServer = (editing?.video_url ?? "")
    .split(/[|\n]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .some((p) => !isAbyssUrl(p));

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

      {subSteps && (
        <div className="mb-4 rounded-xl border border-white/10 bg-ink p-3">
          <ul className="space-y-1 text-[13px]">
            {subSteps.map((s, i) => (
              <li key={i} className={s.ok ? "text-emerald-300" : "text-red-300"}>
                {s.ok ? "\u2713" : "\u2717"} {s.label}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setSubSteps(null)}
            className="mt-2 text-[11px] font-bold text-muted transition hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

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
                <th className="px-4 py-3">Subs</th>
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
                  <td className="px-4 py-2.5 text-white/80">
                    {r.subtitles?.length
                      ? `${r.subtitles.length} track${r.subtitles.length === 1 ? "" : "s"}${
                          r.subtitles.some((s) => s.default) ? " · default" : ""
                        }`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-white/80">{r.duration ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill ok={r.is_premium} text={r.is_premium ? "Yes" : "No"} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        className="px-2.5 py-1"
                        onClick={() => {
                          resetSubUpload();
                          setEditing(r);
                        }}
                      >
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
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
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
                min={0}
                step={0.1}
                className={inputCls}
                value={editing.duration ?? ""}
                placeholder="e.g. 28.2"
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    duration: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
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
              <div className="grid gap-2">
                {["1080p", "720p", "480p"].map((quality, i) => {
                  const parts = (editing?.video_url ?? "")
                    .split("|")
                    .map((s) => s.trim());
                  while (parts.length < 3) parts.push("");
                  const value = parts[i] ?? "";
                  return (
                    <div key={quality} className="flex gap-2">
                      <input
                        className={inputCls}
                        value={value}
                        placeholder={`Server ${i + 1} — ${quality} link`}
                        onChange={(e) => {
                          setEditing((ed) => {
                            if (!ed) return ed;
                            const p = (ed.video_url ?? "")
                              .split("|")
                              .map((s) => s.trim());
                            while (p.length < 3) p.push("");
                            p[i] = e.target.value.trim();
                            const joined = p.join("|").replace(/\|+$/, "");
                            return { ...ed, video_url: joined };
                          });
                        }}
                      />
                      {i === 0 && (
                        <Button
                          variant="ghost"
                          className="shrink-0"
                          onClick={openColabTransfer}
                          title="Generate a Colab notebook or Python script that downloads the link and uploads it to R2 / abyss.to using Google's or GitHub's network (no device bandwidth used)"
                        >
                          Remote via Colab
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-muted">
                Server 1 = 1080p, Server 2 = 720p, Server 3 = 480p. Leave empty
                servers you don&apos;t have; the player shows a button per link.
              </p>
            </Field>
          </div>

          {abyssId && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/[0.06] p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[13px] font-bold text-white">Abyss subtitles</h4>
                <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                  Video ID: {abyssId}
                </span>
              </div>
              <p className="mb-3 text-[12px] leading-5 text-muted">
                This episode is an abyss video, so subtitles are attached to abyss itself and
                appear in the player&apos;s CC menu — they are not stored on this site. Uploads go
                through the secure <b className="text-white">abyss-sub</b> Edge Function, so no
                abyss password ever reaches this browser.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["Sinhala", "English"] as const).map((lang) => (
                  <div key={lang} className="rounded-lg border border-white/10 bg-ink p-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                      {lang} subtitle
                    </p>
                    <label
                      className={`inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-white transition ${
                        subBusy ? "cursor-wait bg-white/10" : "border border-white/10 bg-panel hover:border-primary/60"
                      }`}
                    >
                      {subFiles[lang] ? subFiles[lang]!.name : `Choose ${lang} .vtt / .srt`}
                      <input
                        type="file"
                        accept=".vtt,.srt,text/vtt,application/x-subrip"
                        className="hidden"
                        disabled={subBusy}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          e.target.value = "";
                          setSubFiles((s) => ({ ...s, [lang]: f }));
                        }}
                      />
                    </label>
                    {subFiles[lang] && (
                      <button
                        type="button"
                        onClick={() => setSubFiles((s) => ({ ...s, [lang]: null }))}
                        className="mt-2 text-[11px] font-bold text-muted transition hover:text-white"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-muted">
                Files are renamed to <b className="text-white">sinhala.srt</b> /{" "}
                <b className="text-white">english.srt</b> automatically and pushed to abyss after
                the episode is saved. To replace a subtitle later, use the{" "}
                <b className="text-white">Subtitles</b> tab.
              </p>
            </div>
          )}

          {hasDirectServer && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-bold text-white">
                Subtitles ({editing.subtitles?.length ?? 0})
              </p>
              <Button
                variant="ghost"
                className="px-2.5 py-1 text-xs"
                onClick={() =>
                  setEditing({
                    ...editing,
                    subtitles: [
                      ...(editing.subtitles ?? []),
                      {
                        url: "",
                        label: "",
                        lang: "en",
                        default: (editing.subtitles ?? []).length === 0,
                      },
                    ],
                  })
                }
              >
                + Add subtitle
              </Button>
            </div>
            <p className="mb-3 text-[12px] text-muted">
              WebVTT (.vtt) tracks shown by the <b className="text-white">on-site player</b> — i.e.
              for direct / HLS / archive servers. Viewers switch them with the CC button; mark one
              track as default to show it automatically. These do not affect the abyss player (use
              the abyss panel above for that).
            </p>

            <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-primary/25 bg-primary/[0.06] p-3">
              <Field label="Subtitle language" className="w-40">
                <input
                  className={inputCls}
                  value={subLang}
                  onChange={(e) => setSubLang(e.target.value)}
                  placeholder="English"
                />
              </Field>
              <label
                className={`inline-flex h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-bold text-white transition ${
                  subBusy ? "cursor-wait bg-white/10" : "bg-gradient-btn hover:opacity-90"
                }`}
              >
                {subBusy ? "Uploading…" : "Upload .vtt / .srt"}
                <input
                  type="file"
                  accept=".vtt,.srt,text/vtt,application/x-subrip"
                  className="hidden"
                  disabled={subBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadSubtitleFile(f);
                  }}
                />
              </label>
              <p className="max-w-[360px] text-[12px] leading-5 text-muted">
                Pick a subtitle file from your device — it is saved to this site and served to the
                on-site player.
              </p>
            </div>
            {subMsg && (
              <p className="mb-3 rounded-lg bg-white/5 px-3 py-2 text-[12px] text-white/80">{subMsg}</p>
            )}
            {(editing.subtitles ?? []).length === 0 && (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[13px] text-muted">
                No subtitle tracks — the CC button won&apos;t appear in the player.
              </p>
            )}
            {(editing.subtitles ?? []).map((s, i) => (
              <div
                key={i}
                className="mb-2 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-panel/40 p-3 md:grid-cols-[150px_100px_1fr_90px_36px]"
              >
                <input
                  className={inputCls}
                  placeholder="Label (e.g. English)"
                  value={s.label ?? ""}
                  onChange={(e) => {
                    const next = [...(editing.subtitles ?? [])];
                    next[i] = { ...next[i], label: e.target.value };
                    setEditing({ ...editing, subtitles: next });
                  }}
                />
                <input
                  className={inputCls}
                  placeholder="lang (e.g. en)"
                  value={s.lang ?? ""}
                  onChange={(e) => {
                    const next = [...(editing.subtitles ?? [])];
                    next[i] = { ...next[i], lang: e.target.value };
                    setEditing({ ...editing, subtitles: next });
                  }}
                />
                <input
                  className={inputCls}
                  placeholder="https://.../subs.vtt"
                  value={s.url ?? ""}
                  onChange={(e) => {
                    const next = [...(editing.subtitles ?? [])];
                    next[i] = { ...next[i], url: e.target.value };
                    setEditing({ ...editing, subtitles: next });
                  }}
                />
                <label className="flex h-[38px] items-center justify-center gap-1.5 rounded-lg border border-white/10 text-[12px] font-semibold text-white/80">
                  <input
                    type="checkbox"
                    className="accent-[#7b61ff]"
                    checked={Boolean(s.default)}
                    onChange={(e) => {
                      const next = (editing.subtitles ?? []).map((t, j) => ({
                        ...t,
                        default: e.target.checked ? j === i : Boolean(t.default) && j !== i,
                      }));
                      setEditing({ ...editing, subtitles: next });
                    }}
                  />
                  Default
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = [...(editing.subtitles ?? [])];
                    const removed = next.splice(i, 1)[0];
                    if (removed?.default && next.length) next[0].default = true;
                    setEditing({ ...editing, subtitles: next });
                  }}
                  className="flex h-[38px] items-center justify-center rounded-lg border border-white/10 text-muted transition hover:border-red-400/40 hover:text-red-300"
                  aria-label="Remove subtitle"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          )}

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

      {colabOpen && (
        <Modal title="Remote transfer (Colab)" onClose={() => setColabOpen(false)}>
          <p className="mb-4 text-[13px] leading-6 text-muted">
            Generates a Colab notebook that downloads the direct link, fixes it for browser
            playback (MKV → MP4, DDP → AAC) and uploads it to the storages you tick below —
            everything runs on <b className="text-white">Google&apos;s servers</b>, so your own
            connection is never used. Run it at{" "}
            <span className="font-semibold text-white">colab.research.google.com</span>.
          </p>

          <div className="space-y-4">
            <Field label="Direct video link *">
              <input
                className={inputCls}
                placeholder="https://... direct mp4 link (e.g. seedr.cc)"
                value={colab.url}
                onChange={(e) => setColab({ ...colab, url: e.target.value })}
              />
            </Field>
            <Field label="Filename (optional)">
              <input
                className={inputCls}
                placeholder="naruto-ep1.mp4"
                value={colab.filename}
                onChange={(e) => setColab({ ...colab, filename: e.target.value })}
              />
            </Field>

            <div className="space-y-2 rounded-lg border border-white/10 bg-panel/40 p-3">
              <p className="text-[12px] font-bold uppercase tracking-wide text-muted">
                Upload to
              </p>
              <label className="flex items-center gap-2 text-[13px] font-semibold text-white">
                <input
                  type="checkbox"
                  className="accent-[#7b61ff]"
                  checked={colab.useR2}
                  onChange={(e) => setColab({ ...colab, useR2: e.target.checked })}
                />
                Cloudflare R2
              </label>
              <label className="flex items-center gap-2 text-[13px] font-semibold text-white">
                <input
                  type="checkbox"
                  className="accent-[#7b61ff]"
                  checked={colab.useAbyss}
                  onChange={(e) => setColab({ ...colab, useAbyss: e.target.checked })}
                />
                abyss.to
              </label>
            </div>

            {colab.useR2 && (
              <div className="grid gap-4 rounded-lg border border-white/10 bg-panel/40 p-3 sm:grid-cols-2">
                <Field label="R2 Account ID">
                  <input
                    className={inputCls}
                    placeholder="Cloudflare account id"
                    value={colab.accountId}
                    onChange={(e) => setColab({ ...colab, accountId: e.target.value })}
                  />
                </Field>
                <Field label="R2 bucket">
                  <input
                    className={inputCls}
                    placeholder="animelk"
                    value={colab.bucket}
                    onChange={(e) => setColab({ ...colab, bucket: e.target.value })}
                  />
                </Field>
                <Field label="R2 Access Key ID">
                  <input
                    className={inputCls}
                    value={colab.accessKeyId}
                    onChange={(e) => setColab({ ...colab, accessKeyId: e.target.value })}
                  />
                </Field>
                <Field label="R2 Secret Key">
                  <input
                    type="password"
                    className={inputCls}
                    value={colab.secretAccessKey}
                    onChange={(e) => setColab({ ...colab, secretAccessKey: e.target.value })}
                  />
                </Field>
                <Field label="R2 Public URL" className="sm:col-span-2">
                  <input
                    className={inputCls}
                    placeholder="https://pub-xxxx.r2.dev or https://media.yourdomain.com"
                    value={colab.publicUrl}
                    onChange={(e) => setColab({ ...colab, publicUrl: e.target.value })}
                  />
                </Field>
              </div>
            )}

            {colab.useAbyss && (
              <div className="grid gap-4 rounded-lg border border-white/10 bg-panel/40 p-3 sm:grid-cols-2">
                <Field label="abyss.to API key">
                  <input
                    type="password"
                    className={inputCls}
                    placeholder="Your abyss API key"
                    value={colab.abyssKey}
                    onChange={(e) => setColab({ ...colab, abyssKey: e.target.value })}
                  />
                </Field>
                <Field label="abyss upload base URL">
                  <input
                    className={inputCls}
                    placeholder="https://up.hydrax.net"
                    value={colab.abyssBase}
                    onChange={(e) => setColab({ ...colab, abyssBase: e.target.value })}
                  />
                </Field>
                <p className="text-[12px] text-muted sm:col-span-2">
                  The notebook uploads the video file directly to abyss.to with your API key
                  (POST {`${colab.abyssBase || "https://up.hydrax.net"}`}/{`{apiKey}`}, multipart form
                  field &quot;file&quot;) — no intermediate host needed.
                </p>
              </div>
            )}

            <p className="text-[12px] text-muted">
              Credentials are saved in this browser only (localStorage) — they go into the
              notebook you download and are never sent to our servers.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => setColabOpen(false)}>
              Cancel
            </Button>
            <Button variant="ghost" onClick={downloadLocalScript} title="Run the transfer on your own PC (Python) — avoids Google Colab">
              Download Python script
            </Button>
            <Button onClick={downloadColabTransfer}>Download Colab Notebook</Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}





