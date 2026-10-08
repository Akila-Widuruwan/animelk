"use client";

/**
 * The list a signed-out visitor keeps in this browser. Signed-in viewers have
 * theirs in the account instead, but anything saved here before signing in is
 * still offered for import on the My List page.
 */
export const WATCHLIST_LS_KEY = "animelk-watchlist";

export function readLocalWatchlist(): number[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is number => typeof id === "number" && Number.isFinite(id)
    );
  } catch {
    return [];
  }
}

export function writeLocalWatchlist(ids: number[]): void {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(WATCHLIST_LS_KEY);
      return;
    }
    localStorage.setItem(WATCHLIST_LS_KEY, JSON.stringify(ids));
  } catch {
    // storage unavailable
  }
}

export function setLocalListed(animeId: number, listed: boolean): void {
  const ids = new Set(readLocalWatchlist());
  if (listed) ids.add(animeId);
  else ids.delete(animeId);
  writeLocalWatchlist([...ids]);
}
