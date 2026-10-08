"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useViewer } from "@/lib/viewer-auth";
import {
  COMMENT_MAX,
  CommentsNotReadyError,
  deleteComment,
  fetchComments,
  postComment,
  type Comment,
} from "@/lib/comments";
import { IconClose } from "../Icons";

interface Props {
  animeId: number;
  /** The episodes row, or null when the title has no episode row (a movie). */
  episodeId: number | null;
  /** What the thread is about, for the prompts: "Episode 3" or "this movie". */
  subject: string;
}

/**
 * Identifies the thread. Stored alongside the loaded page so stepping to the
 * next episode falls straight back to the skeleton instead of briefly showing
 * the previous episode's comments, without a state reset inside an effect.
 */
function scopeKeyOf(animeId: number, episodeId: number | null): string {
  return `${animeId}:${episodeId ?? "none"}`;
}

/** One loaded page, tagged with the thread it belongs to. */
interface ThreadState {
  key: string;
  rows: Comment[];
  /** Exact number of comments in the thread, straight from the server. */
  total: number | null;
  error: string;
}

/** Short relative time, e.g. "3 hours ago". */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function Avatar({
  name,
  url,
  size = 36,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  if (url) {
    return (
      // Google hosts avatars on its own domains, so this stays a plain image
      // rather than going through next/image host allow-listing.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover ring-1 ring-white/15"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="bg-gradient-btn flex shrink-0 items-center justify-center rounded-full font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/**
 * The comment thread for one episode, or for a movie that has no episode row.
 * Anyone can read it; posting and deleting need a signed-in viewer, and the
 * policies in 0012_comments.sql only accept a row that matches the session.
 */
export default function Comments({ animeId, episodeId, subject }: Props) {
  const { viewer, loading } = useViewer();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scopeKey = scopeKeyOf(animeId, episodeId);

  /** null until the first read settles, so the empty state never flashes. */
  const [state, setState] = useState<ThreadState | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [confirming, setConfirming] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  /** True once we know the comments table is not deployed yet. */
  const [notReady, setNotReady] = useState(false);

  // A page loaded for a different thread reads as "not loaded yet".
  const thread = state && state.key === scopeKey ? state.rows : null;
  const total = state && state.key === scopeKey ? state.total : null;
  const error = state && state.key === scopeKey ? state.error : "";

  const query = searchParams.toString();
  const signInHref = `/login?next=${encodeURIComponent(
    query ? `${pathname}?${query}` : pathname
  )}`;

  // Load the thread; runs again when the viewer steps to another episode.
  useEffect(() => {
    const key = scopeKeyOf(animeId, episodeId);
    let cancelled = false;
    void (async () => {
      try {
        const page = await fetchComments({ animeId, episodeId }, 0);
        if (cancelled) return;
        setState({
          key,
          rows: page.rows,
          total: page.total,
          error: "",
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof CommentsNotReadyError) {
          setNotReady(true);
          return;
        }
        setState({
          key,
          rows: [],
          total: null,
          error:
            err instanceof Error ? err.message : "Could not load comments.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [animeId, episodeId]);

  /** The state a write should apply to, even if this thread has not loaded. */
  const baseState = (prev: ThreadState | null): ThreadState =>
    prev && prev.key === scopeKey
      ? prev
      : { key: scopeKey, rows: [], total: null, error: "" };

  const loadMore = async () => {
    if (thread === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchComments({ animeId, episodeId }, thread.length);
      setState((prev) => {
        const base = baseState(prev);
        return {
          ...base,
          rows: [...base.rows, ...page.rows],
          total: page.total,
          error: "",
        };
      });
    } catch (err) {
      setState((prev) => ({
        ...baseState(prev),
        error: err instanceof Error ? err.message : "Could not load more.",
      }));
    } finally {
      setLoadingMore(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!viewer || posting) return;
    const text = body.trim();
    if (!text) {
      setPostError("Write something first.");
      return;
    }
    setPosting(true);
    setPostError("");
    try {
      const posted = await postComment({ animeId, episodeId }, text, {
        name: viewer.name,
        avatar: viewer.avatarUrl,
      });
      setState((prev) => {
        const base = baseState(prev);
        return {
          ...base,
          rows: [posted, ...base.rows],
          total: base.total === null ? null : base.total + 1,
        };
      });
      setBody("");
    } catch (err) {
      if (err instanceof CommentsNotReadyError) {
        setNotReady(true);
        return;
      }
      setPostError(
        err instanceof Error ? err.message : "Could not post your comment."
      );
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: number) => {
    setConfirming(null);
    setRemoving((prev) => [...prev, id]);
    setPostError("");
    try {
      await deleteComment(id);
      setState((prev) => {
        const base = baseState(prev);
        return {
          ...base,
          rows: base.rows.filter((c) => c.id !== id),
          total: base.total === null ? null : Math.max(0, base.total - 1),
        };
      });
    } catch (err) {
      setPostError(
        err instanceof Error ? err.message : "Could not delete your comment."
      );
    } finally {
      setRemoving((prev) => prev.filter((x) => x !== id));
    }
  };

  // Nothing to show while the migration is still missing, so a site that has
  // not run it yet looks exactly as it did before this feature.
  if (notReady) return null;

  const hasMore = total !== null ? (thread?.length ?? 0) < total : false;

  return (
    <section className="mt-10 border-t border-white/[0.06] pt-7">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[17px] font-extrabold tracking-tight text-white md:text-[19px]">
          Comments
        </h2>
        {total !== null && total > 0 && (
          <span className="text-[13px] font-semibold text-muted">
            {total} on {subject}
          </span>
        )}
      </div>

      {!viewer && !loading && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-panel/50 px-5 py-4">
          <p className="text-[13.5px] text-body">
            Sign in with Google to comment on {subject}. Everyone can read the
            thread.
          </p>
          <Link
            href={signInHref}
            className="bg-gradient-btn rounded-full px-4 py-2 text-[12.5px] font-bold text-white transition hover:opacity-90"
          >
            Continue with Google
          </Link>
        </div>
      )}

      {viewer && (
        <form
          onSubmit={submit}
          className="mt-4 rounded-xl border border-white/[0.07] bg-panel/40 p-4"
        >
          <div className="flex items-center gap-3">
            <Avatar name={viewer.name} url={viewer.avatarUrl} size={32} />
            <span className="min-w-0 truncate text-[13px] font-bold text-white">
              {viewer.name}
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={COMMENT_MAX}
            aria-label={`Comment on ${subject}`}
            placeholder={`Add a comment on ${subject}…`}
            className="mt-3 w-full resize-y rounded-lg border border-white/10 bg-ink/60 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white placeholder:text-muted focus:border-violet-2/60 focus:outline-none"
          />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span className="text-[12px] text-muted">
              {body.length > COMMENT_MAX - 400
                ? `${body.length}/${COMMENT_MAX}`
                : ""}
            </span>
            <button
              type="submit"
              disabled={posting || !body.trim()}
              className="bg-gradient-btn rounded-full px-5 py-2 text-[12.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {posting ? "Posting…" : "Post comment"}
            </button>
          </div>
          {postError && (
            <p className="mt-2.5 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
              {postError}
            </p>
          )}
        </form>
      )}

      {thread === null ? (
        <div className="mt-5 space-y-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block h-[76px] animate-pulse rounded-xl bg-panel"
            />
          ))}
        </div>
      ) : (
        <>
          {error && (
            <p className="mt-5 rounded-lg bg-red-500/10 px-4 py-2.5 text-[13px] text-red-300">
              {error}
            </p>
          )}

          {thread.length > 0 ? (
            <ul className="mt-5 space-y-3">
              {thread.map((c) => {
                const mine = Boolean(viewer) && viewer?.id === c.user_id;
                const busy = removing.includes(c.id);
                return (
                  <li
                    key={c.id}
                    className="flex gap-3 rounded-xl border border-white/[0.06] bg-panel/30 p-4"
                  >
                    <Avatar name={c.author_name} url={c.author_avatar} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="text-[13px] font-bold text-white">
                          {c.author_name}
                        </span>
                        {mine && (
                          <span className="rounded bg-violet-2/20 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-violet-2">
                            You
                          </span>
                        )}
                        <time
                          dateTime={c.created_at}
                          className="text-[12px] text-muted"
                        >
                          {timeAgo(c.created_at)}
                        </time>
                        {mine && (
                          <span className="ml-auto flex items-center gap-2">
                            {confirming === c.id ? (
                              <>
                                <button
                                  onClick={() => void remove(c.id)}
                                  disabled={busy}
                                  className="text-[11.5px] font-bold text-red-300 transition hover:text-red-200 disabled:opacity-50"
                                >
                                  {busy ? "Removing…" : "Delete"}
                                </button>
                                <button
                                  onClick={() => setConfirming(null)}
                                  className="text-[11.5px] font-semibold text-muted transition hover:text-white"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirming(c.id)}
                                className="flex items-center gap-1 text-[11.5px] font-semibold text-muted transition hover:text-red-300"
                              >
                                <IconClose className="h-3 w-3" />
                                Remove
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 whitespace-pre-line break-words text-[13.5px] leading-[1.65] text-body">
                        {c.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            !error && (
              <p className="mt-5 rounded-xl border border-white/[0.06] bg-panel/30 px-5 py-8 text-center text-[13.5px] text-muted">
                No comments on {subject} yet.
              </p>
            )
          )}

          {hasMore && (
            <button
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="mt-4 rounded-full border border-white/12 px-5 py-2 text-[12.5px] font-bold text-white transition hover:border-violet-2/60 disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : "Show more comments"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
