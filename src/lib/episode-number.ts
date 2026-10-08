/**
 * Episode numbering.
 *
 * Episode numbers are not always whole, and a season's episodes do not always
 * start at 1:
 *
 *   - a "Part 2" continues the previous part, so its episodes are 13–24;
 *   - split cours, recaps and specials get half numbers (12.5, 13.5);
 *   - a back-catalogue title may only have episodes 5, 6 and 9 uploaded.
 *
 * Everything that lists, links or steps through episodes therefore works from
 * the numbers that actually exist in the database instead of assuming 1..N.
 */

export interface NumberedEpisode {
  /** May arrive as a number or as a string, depending on the column type. */
  episode_number: number | string | null | undefined;
}

/** Coerces a PostgREST value (numeric can arrive as a string) to a number. */
export function toEpisodeNumber(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/** Compare two episode numbers, tolerant of 13.5 vs "13.5" round-tripping. */
export function sameEpisode(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
}

/** "13" for 13 and "13.5" for 13.5 — never "13.0". */
export function episodeLabel(value: number | string | null | undefined): string {
  const n = toEpisodeNumber(value);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/** The episode numbers that exist, ascending and de-duplicated. */
export function episodeNumbers(rows: NumberedEpisode[]): number[] {
  const seen = new Set<number>();
  for (const row of rows) {
    const n = toEpisodeNumber(row.episode_number);
    if (Number.isFinite(n)) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * The episode to open for `?ep=`.
 *
 * With no usable parameter, the first episode that exists is used — so the
 * Play button on a title numbered 13–24 opens episode 13 rather than an empty
 * player. An explicit number that does not exist is kept as-is, so the player
 * can still say "nothing uploaded for this episode yet".
 */
export function resolveEpisodeNumber(
  requested: string | number | null | undefined,
  numbers: number[]
): number {
  const parsed = toEpisodeNumber(
    typeof requested === "string" ? requested.trim() : requested
  );
  if (Number.isFinite(parsed) && parsed > 0) {
    return numbers.find((n) => sameEpisode(n, parsed)) ?? parsed;
  }
  return numbers[0] ?? 1;
}

/** The neighbouring episodes that exist — adjacent in the list, not ep ± 1. */
export function episodeNeighbours(
  numbers: number[],
  current: number
): { prev: number | null; next: number | null } {
  const index = numbers.findIndex((n) => sameEpisode(n, current));
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? numbers[index - 1] : null,
    next: index < numbers.length - 1 ? numbers[index + 1] : null,
  };
}
