import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseBrowser } from "./supabase-browser";

/** One posted comment, as the comment thread renders it. */
export interface Comment {
  id: number;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  body: string;
  created_at: string;
}

/**
 * What a thread belongs to: an episode, or the title itself when it has no
 * episode row (a movie that is a single video). `episodeId` null keeps the
 * conversation on the anime row so those titles are not left without comments.
 */
export interface CommentScope {
  animeId: number;
  episodeId: number | null;
}

export interface CommentPage {
  rows: Comment[];
  /** Exact number of comments in this thread, when the server reports it. */
  total: number | null;
}

/** Longest comment the database accepts (see 0012_comments.sql). */
export const COMMENT_MAX = 2000;
/** How many comments load at a time. */
export const COMMENT_PAGE = 20;

/**
 * Thrown when the comments table is not there yet, which is the state between
 * deploying this feature and running supabase/migrations/0012_comments.sql in
 * the SQL editor. The thread hides itself instead of showing an error, so a
 * site that has not run the migration yet looks no different.
 */
export class CommentsNotReadyError extends Error {
  constructor() {
    super("Comments are not set up yet.");
    this.name = "CommentsNotReadyError";
  }
}

/** PostgREST answers a missing table with this code. */
function isMissingTable(code: string | undefined): boolean {
  return code === "PGRST205" || code === "42P01";
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
 * One page of a thread, newest first. Throws on a failed read so the thread can
 * tell "nothing written yet" apart from "could not load", and throws
 * CommentsNotReadyError while the table is still missing.
 */
export async function fetchComments(
  scope: CommentScope,
  offset = 0,
  limit = COMMENT_PAGE
): Promise<CommentPage> {
  const sb = supabaseBrowser();
  let query = sb
    .from("comments")
    .select("id, user_id, author_name, author_avatar, body, created_at", {
      count: "exact",
    })
    .eq("anime_id", scope.animeId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // A movie with no episode row talks on the anime itself; without this the
  // query would match every episode thread on the title instead.
  query = scope.episodeId === null
    ? query.is("episode_id", null)
    : query.eq("episode_id", scope.episodeId);

  const { data, error, count } = await query;
  if (error) {
    if (isMissingTable(error.code)) throw new CommentsNotReadyError();
    throw new Error(error.message);
  }
  return { rows: (data as Comment[] | null) ?? [], total: count ?? null };
}

/**
 * Posts one comment as the signed-in viewer. The author id comes from the
 * session, never from the caller, and the row is returned so the thread can
 * show it at the top without a second read.
 */
export async function postComment(
  scope: CommentScope,
  body: string,
  author: { name: string; avatar: string | null }
): Promise<Comment> {
  const sb = supabaseBrowser();
  const uid = await currentUserId(sb);
  if (!uid) throw new Error("Sign in to comment.");

  const text = body.trim();
  if (!text) throw new Error("Write something first.");
  if (text.length > COMMENT_MAX) {
    throw new Error(`Comments are limited to ${COMMENT_MAX} characters.`);
  }

  const { data, error } = await sb
    .from("comments")
    .insert({
      anime_id: scope.animeId,
      episode_id: scope.episodeId,
      user_id: uid,
      author_name: author.name,
      author_avatar: author.avatar,
      body: text,
    })
    .select("id, user_id, author_name, author_avatar, body, created_at")
    .single();
  if (error) {
    if (isMissingTable(error.code)) throw new CommentsNotReadyError();
    throw new Error(error.message);
  }
  return data as Comment;
}

/** Deletes one of the viewer's own comments. RLS rejects anyone else's. */
export async function deleteComment(id: number): Promise<void> {
  const sb = supabaseBrowser();
  const uid = await currentUserId(sb);
  if (!uid) throw new Error("Sign in to delete a comment.");
  const { error } = await sb
    .from("comments")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);
  if (error) {
    if (isMissingTable(error.code)) throw new CommentsNotReadyError();
    throw new Error(error.message);
  }
}
