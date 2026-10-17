"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithGoogle, signOutViewer, useViewer } from "@/lib/viewer-auth";
import { errorFromHash } from "@/lib/auth-errors";

/** Set before leaving for Google so the return trip knows to move on. */
const OAUTH_PENDING = "anilanka-oauth-pending";

/** The fragment never changes under this component, so nothing to subscribe to. */
const subscribeToNothing = () => () => {};
const readHashError = () => errorFromHash(window.location.hash);
const readNoHashError = () => "";

/** Only in-site paths are accepted, so `?next=` cannot bounce a visitor off-site. */
export function safeNext(raw: string | null): string {
  if (!raw) return "";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "";
  return raw;
}

function GoogleMark({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.97-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function GoogleSignIn({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const { viewer, loading } = useViewer();
  const [busy, setBusy] = useState(false);
  // The server reads the query string. The fragment only exists in the
  // browser, so it is read as an external store: React uses the empty server
  // snapshot while hydrating and the real one immediately afterwards, which
  // keeps the markup identical without a setState-in-effect round trip.
  const [error, setError] = useState(initialError);
  const hashError = useSyncExternalStore(
    subscribeToNothing,
    readHashError,
    readNoHashError
  );
  const shownError = error || hashError;

  // Read `next` once, during the first render, before supabase-js gets a
  // chance to consume the OAuth tokens on the same URL. It is only used from
  // handlers and effects, so the server/client difference is harmless.
  const [next] = useState(() => {
    if (typeof window === "undefined") return "";
    return safeNext(new URLSearchParams(window.location.search).get("next"));
  });

  // A failed round trip must not leave the pending marker behind.
  useEffect(() => {
    if (!shownError) return;
    try {
      sessionStorage.removeItem(OAUTH_PENDING);
    } catch {
      // storage unavailable
    }
  }, [shownError]);

  // Drop the failure from the address bar once it has been read, otherwise a
  // refresh (or a bookmark of this tab) replays an error that is already over.
  // The hash is left alone: on a successful return it is what carries the
  // session, and supabase-js reads it after this render.
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of ["error", "error_code", "error_description"]) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  // Once the session appears after a Google round trip, continue where the
  // visitor was heading. A visitor who opens /login while already signed in
  // stays here and sees their account instead.
  useEffect(() => {
    if (loading || !viewer) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(OAUTH_PENDING);
    } catch {
      pending = null;
    }
    if (pending === null) return;
    try {
      sessionStorage.removeItem(OAUTH_PENDING);
    } catch {
      // storage unavailable
    }
    router.replace(safeNext(pending) || "/");
  }, [loading, viewer, router]);

  const start = async () => {
    setBusy(true);
    setError("");
    const target = next || "/";
    try {
      sessionStorage.setItem(OAUTH_PENDING, target);
    } catch {
      // storage unavailable — the return trip lands on the homepage
    }
    const message = await signInWithGoogle(target);
    if (message) {
      setBusy(false);
      setError(message);
    }
    // On success the browser is already navigating to Google.
  };

  const signOut = async () => {
    setBusy(true);
    await signOutViewer();
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-panel p-10">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <p className="text-[13px] text-muted">Checking your session…</p>
      </div>
    );
  }

  if (viewer) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-panel p-8 shadow-2xl">
        <h1 className="text-xl font-extrabold text-white">
          ANI<span className="text-gradient">LANKA</span> account
        </h1>
        <div className="mt-6 flex items-center gap-3.5">
          {viewer.avatarUrl ? (
            // Google hosts avatars on its own domains, so this stays a plain
            // image rather than going through next/image host allow-listing.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewer.avatarUrl}
              alt=""
              width={48}
              height={48}
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-full object-cover ring-1 ring-white/15"
            />
          ) : (
            <span className="bg-gradient-btn flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold text-white">
              {viewer.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold text-white">
              {viewer.name}
            </span>
            {viewer.email && (
              <span className="block truncate text-[12.5px] text-muted">
                {viewer.email}
              </span>
            )}
          </span>
        </div>

        <p className="mt-6 text-[13px] leading-relaxed text-body">
          Your watchlist and continue-watching progress are saved to this
          account on every device you sign in on.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/"
            className="bg-gradient-btn rounded-full px-5 py-2.5 text-center text-[13px] font-bold text-white transition hover:opacity-90"
          >
            Keep watching
          </Link>
          <button
            onClick={signOut}
            disabled={busy}
            className="rounded-full border border-white/12 px-5 py-2.5 text-[13px] font-bold text-white transition hover:border-primary/60 disabled:opacity-60"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-panel p-8 shadow-2xl">
      <h1 className="text-xl font-extrabold text-white">
        ANI<span className="text-gradient">LANKA</span>
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        Sign in to keep your watchlist and continue watching in sync on every
        device.
      </p>

      <button
        onClick={start}
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-[14px] font-bold text-[#1f1f1f] transition hover:bg-white/90 disabled:opacity-70"
      >
        <GoogleMark />
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>

      <p className="mt-5 text-center text-[12px] leading-relaxed text-muted">
        New here? Signing up is the same button — your AniLanka account is
        created on your first sign-in. We only read your name, email and
        profile picture.
      </p>

      {shownError && (
        <p className="mt-5 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {shownError}
        </p>
      )}

      <p className="mt-5 border-t border-white/5 pt-4 text-center text-[12px] text-muted">
        Are you staff? Use the{" "}
        <Link href="/admin" className="font-bold text-white/80 hover:text-white">
          admin
        </Link>{" "}
        sign-in instead.
      </p>
    </div>
  );
}
