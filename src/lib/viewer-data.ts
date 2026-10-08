"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseBrowser } from "./supabase-browser";

/** Only titles watched for at least this long show up in Continue Watching. */
export const RESUME_MIN_SECONDS = 60;

/** Cloud progress is written at most this often while playback runs. */
export const CLOUD_SAVE_INTERVAL_MS = 30_000;

export interface ContinueItem {
  animeId: number;
  ep: number;
  time: number;
  title: string;
  image: string | null;
  durationMin: number | null;
}

async function currentUserId(sb: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await sb.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * The signed-in viewer's list, newest addition first. Throws when the read
 * fails so the My List page can tell "nothing saved" apart from "could not
 * load".
 */
export async function fetchWatchlist(limit = 200): Promise<number[]> {
  const sb = supabaseBrowser();
  const uid = await currentUserId(sb);
  if (!uid) return [];
  const { data, error } = await sb
    .from("watchlist")
    .select("anime_id, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data as { anime_id: number }[] | null) ?? []).map((r) => r.anime_id);
}

/** The ids in the signed-in viewer's list. */
export async function fetchWatchlistIds(): Promise<Set<number>> {
  return new Set(await fetchWatchlist());
}

/**
 * Moves the signed-out browser list into the account, so a visitor who saved
 * titles before signing in keeps them. Already-saved titles are left alone.
 * Returns how many were added.
 */
export async function importLocalWatchlist(animeIds: number[]): Promise<number> {
  const sb = supabaseBrowser();
  const uid = await currentUserId(sb);
  if (!uid) throw new Error("You are not signed in.");
  const wanted = [...new Set(animeIds)].filter((id) => Number.isFinite(id));
  if (wanted.length === 0) return 0;
  const { data, error: readError } = await sb
    .from("watchlist")
    .select("anime_id")
    .eq("user_id", uid)
    .in("anime_id", wanted);
  if (readError) throw new Error(readError.message);
  const already = new Set(
    ((data as { anime_id: number }[] | null) ?? []).map((r) => r.anime_id)
  );
  const fresh = wanted.filter((id) => !already.has(id));
  if (fresh.length === 0) return 0;
  const { error } = await sb.from("watchlist").upsert(
    fresh.map((animeId) => ({ user_id: uid, anime_id: animeId })),
    { onConflict: "user_id,anime_id", ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
  return fresh.length;
}

/** Adds or removes one title from the signed-in viewer's list. */
export async function toggleWatchlist(
  animeId: number,
  add: boolean
): Promise<void> {
  const sb = supabaseBrowser();
  const uid = await currentUserId(sb);
  if (!uid) throw new Error("You are not signed in.");
  if (add) {
    const { error } = await sb
      .from("watchlist")
      .upsert(
        { user_id: uid, anime_id: animeId },
        { onConflict: "user_id,anime_id", ignoreDuplicates: true }
      );
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await sb
    .from("watchlist")
    .delete()
    .eq("user_id", uid)
    .eq("anime_id", animeId);
  if (error) throw new Error(error.message);
}

/** The newest row for one title/episode pair, or null. */
async function findProgressRow(
  sb: SupabaseClient,
  uid: string,
  animeId: number,
  episodeId: number | null
): Promise<{ id: number; position_seconds: number } | null> {
  let query = sb
    .from("watch_history")
    .select("id, position_seconds")
    .eq("user_id", uid)
    .eq("anime_id", animeId);
  query =
    episodeId === null
      ? query.is("episode_id", null)
      : query.eq("episode_id", episodeId);
  const { data } = await query
    .order("watched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: number; position_seconds: number } | null) ?? null;
}

/**
 * Stores the viewer's position in one episode. One row per
 * (viewer, title, episode) is kept up to date rather than appending a row per
 * save, so the table stays small and "Continue Watching" is a simple newest-first read.
 */
export async function saveWatchProgress({
  animeId,
  episodeId,
  positionSeconds,
}: {
  animeId: number;
  episodeId: number | null;
  positionSeconds: number;
}): Promise<void> {
  const sb = supabaseBrowser();
  const uid = await currentUserId(sb);
  if (!uid) return;
  const position = Math.max(0, Math.floor(positionSeconds));
  const existing = await findProgressRow(sb, uid, animeId, episodeId);
  if (existing) {
    if (existing.position_seconds === position) return;
    await sb
      .from("watch_history")
      .update({ position_seconds: position, watched_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("user_id", uid);
    return;
  }
  await sb.from("watch_history").insert({
    user_id: uid,
    anime_id: animeId,
    episode_id: episodeId,
    position_seconds: position,
    watched_at: new Date().toISOString(),
  });
}

/** The viewer's saved position for one episode, if any. */
export async function fetchResumePosition(
  animeId: number,
  episodeId: number | null
): Promise<number | null> {
  const sb = supabaseBrowser();
  const uid = await currentUserId(sb);
  if (!uid) return null;
  const row = await findProgressRow(sb, uid, animeId, episodeId);
  return row?.position_seconds ?? null;
}

interface HistoryRow {
  anime_id: number;
  position_seconds: number;
  episodes: { episode_number: number } | null;
  anime: {
    id: number;
    title: string;
    cover_image: string | null;
    banner_image: string | null;
    duration: number | null;
    is_active: boolean | null;
  } | null;
}

/**
 * The viewer's Continue Watching row, newest first and one entry per title —
 * the most recently watched episode wins.
 */
export async function fetchContinueWatching(
  limit = 12
): Promise<ContinueItem[]> {
  const sb = supabaseBrowser();
  const uid = await currentUserId(sb);
  if (!uid) return [];
  const { data, error } = await sb
    .from("watch_history")
    .select(
      "anime_id, position_seconds, watched_at, episodes(episode_number), anime(id, title, cover_image, banner_image, duration, is_active)"
    )
    .eq("user_id", uid)
    .order("watched_at", { ascending: false })
    .limit(60);
  if (error) return [];

  const seen = new Set<number>();
  const items: ContinueItem[] = [];
  for (const row of (data as unknown as HistoryRow[] | null) ?? []) {
    const anime = row.anime;
    // Titles switched off in the admin panel, or rows whose title/episode is
    // no longer readable, are hidden from the public site.
    if (!anime || anime.is_active === false) continue;
    if (row.position_seconds < RESUME_MIN_SECONDS) continue;
    if (seen.has(row.anime_id)) continue;
    seen.add(row.anime_id);
    items.push({
      animeId: row.anime_id,
      ep: row.episodes?.episode_number ?? 1,
      time: row.position_seconds,
      title: anime.title,
      image: anime.banner_image || anime.cover_image || null,
      durationMin: anime.duration ?? null,
    });
    if (items.length >= limit) break;
  }
  return items;
}
