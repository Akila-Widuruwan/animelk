/** Shared, browser-safe subtitle helpers (no node-only imports). */

const VTT_HEADER = /^\uFEFF?\s*WEBVTT/i;

export function isVtt(text: string): boolean {
  return VTT_HEADER.test(text.trimStart());
}

/** Converts an SRT subtitle to WebVTT. */
export function srtToVtt(srt: string): string {
  const lines = srt.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = ["WEBVTT", ""];
  for (const line of lines) {
    if (/^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(line)) {
      out.push(line.replace(/,/g, "."));
    } else if (/^\d+$/.test(line.trim())) {
      continue;
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

/** Accepts either WebVTT or SubRip text and always returns WebVTT. */
export function normalizeSubtitle(text: string): string {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  return isVtt(clean) ? clean : srtToVtt(clean);
}

const LANG_CODES: Record<string, string> = {
  english: "en",
  sinhala: "si",
  tamil: "ta",
  hindi: "hi",
  japanese: "ja",
  korean: "ko",
  chinese: "zh",
  arabic: "ar",
  spanish: "es",
  french: "fr",
  german: "de",
  portuguese: "pt",
  russian: "ru",
  indonesian: "id",
  malay: "ms",
  thai: "th",
  turkish: "tr",
};

/** Best-effort BCP-47 language code for a human label like "Sinhala". */
export function guessLangCode(label: string): string {
  const key = label.trim().toLowerCase();
  const known = Object.keys(LANG_CODES).find((name) => key.includes(name));
  if (known) return LANG_CODES[known];
  return /^[a-z]{2,3}$/.test(key) ? key : "en";
}

/** A storage-safe ".vtt" filename derived from the uploaded file name. */
export function safeSubtitleName(filename: string): string {
  const base = (filename.replace(/\\/g, "/").split("/").pop() || "subtitle").trim();
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  const name = cleaned || "subtitle";
  return /\.(vtt|srt)$/i.test(name) ? name : `${name}.vtt`;
}
