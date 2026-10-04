"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { extractAbyssSlug } from "@/lib/abyss-slug";
import { pushSubtitleToAbyss, type AbyssSubtitleLanguage } from "@/lib/abyss-sub";
import { Button, Field, inputCls } from "./ui";

/**
 * "Update Subtitle" — re-upload a Sinhala/English subtitle for an existing
 * abyss episode. The episode is read from Supabase, the abyss file id is
 * extracted from its video_url, and the file is pushed through the secure
 * abyss-sub Edge Function (the same one used during Deploy Episode).
 */

interface AnimeOption {
  id: number;
  title: string;
}

interface EpisodeOption {
  id: number;
  episode_number: number;
  title: string | null;
  video_url: string | null;
}

interface StatusLine {
  label: string;
  ok: boolean;
}

export default function SubtitleUpdater() {
  const sb = supabaseBrowser();
  const [anime, setAnime] = useState<AnimeOption[]>([]);
  const [animeId, setAnimeId] = useState<number | "">("");
  const [episodes, setEpisodes] = useState<EpisodeOption[]>([]);
  const [episodeId, setEpisodeId] = useState<number | "">("");
  const [language, setLanguage] = useState<AbyssSubtitleLanguage>("Sinhala");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<StatusLine[] | null>(null);
  const [loadingAnime, setLoadingAnime] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data } = await sb.from("anime").select("id, title").order("title").limit(1000);
      if (ignore) return;
      setAnime((data as AnimeOption[]) ?? []);
      setLoadingAnime(false);
    })();
    return () => {
      ignore = true;
    };
  }, [sb]);

  useEffect(() => {
    if (animeId === "") return;
    let ignore = false;
    (async () => {
      const { data } = await sb
        .from("episodes")
        .select("id, episode_number, title, video_url")
        .eq("anime_id", animeId)
        .order("episode_number");
      if (ignore) return;
      setEpisodes((data as EpisodeOption[]) ?? []);
      setEpisodeId("");
    })();
    return () => {
      ignore = true;
    };
  }, [sb, animeId]);

  const episode = useMemo(
    () => episodes.find((e) => e.id === episodeId) ?? null,
    [episodes, episodeId]
  );
  const abyssId = episode ? extractAbyssSlug(episode.video_url ?? "") : null;
  const abyssEpisodes = useMemo(
    () => episodes.filter((e) => extractAbyssSlug(e.video_url ?? "")),
    [episodes]
  );

  const upload = async () => {
    if (!episode) {
      setSteps([{ label: "Select an episode first.", ok: false }]);
      return;
    }
    if (!abyssId) {
      setSteps([
        { label: "This episode is not an abyss video (no abyss embed URL).", ok: false },
      ]);
      return;
    }
    if (!file) {
      setSteps([{ label: `Choose a ${language} subtitle file.`, ok: false }]);
      return;
    }

    setBusy(true);
    const result = await pushSubtitleToAbyss({ fileId: abyssId, language, file });
    setBusy(false);
    setSteps([
      { label: `Abyss video detected (${abyssId})`, ok: true },
      {
        label: result.ok
          ? `${language} subtitle uploaded`
          : `${language} subtitle upload failed${result.error ? ` — ${result.error}` : ""}`,
        ok: result.ok,
      },
    ]);
    if (result.ok) setFile(null);
  };

  return (
    <div>
      <div className="mb-5 rounded-xl border border-white/10 bg-panel p-5">
        <h3 className="text-sm font-bold text-white">Update Subtitle</h3>
        <p className="mt-1 mb-4 text-[12px] leading-5 text-muted">
          Re-attach a Sinhala or English subtitle to an existing abyss episode — useful when the
          original upload failed or the subtitle changed. The abyss video ID is read from the
          episode automatically; you never type it in.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Anime">
            <select
              className={inputCls}
              value={animeId}
              disabled={loadingAnime}
              onChange={(e) => {
                setAnimeId(e.target.value === "" ? "" : Number(e.target.value));
                setEpisodes([]);
                setEpisodeId("");
              }}
            >
              <option value="">— Select anime —</option>
              {anime.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Episode (abyss videos only)">
            <select
              className={inputCls}
              value={episodeId}
              disabled={animeId === "" || abyssEpisodes.length === 0}
              onChange={(e) => setEpisodeId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">
                {animeId === ""
                  ? "— Select anime first —"
                  : abyssEpisodes.length === 0
                    ? "No abyss episodes"
                    : "— Select episode —"}
              </option>
              {abyssEpisodes.map((e) => (
                <option key={e.id} value={e.id}>
                  Ep {e.episode_number}
                  {e.title ? ` — ${e.title}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Language">
            <select
              className={inputCls}
              value={language}
              onChange={(e) => setLanguage(e.target.value as AbyssSubtitleLanguage)}
            >
              <option value="Sinhala">Sinhala</option>
              <option value="English">English</option>
            </select>
          </Field>

          <Field label="Subtitle file (.vtt / .srt)">
            <label
              className={`inline-flex h-[38px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-bold text-white transition ${
                busy ? "cursor-wait bg-white/10" : "border border-white/10 bg-ink hover:border-primary/60"
              }`}
            >
              {file ? file.name : "Choose file"}
              <input
                type="file"
                accept=".vtt,.srt,text/vtt,application/x-subrip"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
          </Field>
        </div>

        {episode && (
          <p className="mt-3 text-[12px] text-muted">
            Video ID:{" "}
            {abyssId ? (
              <b className="text-emerald-300">{abyssId}</b>
            ) : (
              <b className="text-red-300">not an abyss video</b>
            )}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={upload} disabled={busy}>
            {busy ? "Uploading…" : "Upload to Abyss"}
          </Button>
        </div>

        {steps && (
          <ul className="mt-4 space-y-1 rounded-lg border border-white/10 bg-ink p-3 text-[13px]">
            {steps.map((s, i) => (
              <li key={i} className={s.ok ? "text-emerald-300" : "text-red-300"}>
                {s.ok ? "\u2713" : "\u2717"} {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[12px] leading-5 text-muted">
        Uploads run inside the <b className="text-white">abyss-sub</b> Supabase Edge Function. The
        abyss email/password and JWT stay in the function&apos;s secrets and are never sent to this
        browser.
      </p>
    </div>
  );
}
