"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "./supabase-browser";

/** The signed-in site visitor — not a staff/admin account. */
export interface Viewer {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
}

function metaString(user: User, ...keys: string[]): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function viewerFromUser(user: User): Viewer {
  const email = user.email ?? null;
  return {
    id: user.id,
    email,
    // Google sends full_name (and picture) on the OAuth profile, which
    // Supabase normalises into user_metadata.
    name:
      metaString(user, "full_name", "name", "username") ??
      email?.split("@")[0] ??
      "Viewer",
    avatarUrl: metaString(user, "avatar_url", "picture"),
  };
}

/**
 * Where Supabase sends the browser back to after Google. The `next` path is
 * carried through the OAuth round trip so the visitor lands where they left.
 */
export function loginRedirectUrl(nextPath = "/"): string {
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
}

/**
 * Starts Google OAuth. Sign-up and sign-in are the same call: Supabase creates
 * the account on the first visit and signs the visitor in afterwards.
 * Returns an error message instead of throwing so callers can show it inline.
 */
export async function signInWithGoogle(nextPath = "/"): Promise<string | null> {
  try {
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: loginRedirectUrl(nextPath),
        queryParams: { prompt: "select_account" },
      },
    });
    return error ? error.message : null;
  } catch (err) {
    return err instanceof Error ? err.message : "Could not reach Google sign-in.";
  }
}

export async function signOutViewer(): Promise<void> {
  try {
    await supabaseBrowser().auth.signOut();
  } catch {
    // already signed out
  }
}

/**
 * Reads the current session once and then follows sign in/out for the life of
 * the component. `loading` is true until the first read finishes, so callers
 * can avoid flashing a signed-out UI for a signed-in visitor.
 */
export function useViewer(): { viewer: Viewer | null; loading: boolean } {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = supabaseBrowser();
    let mounted = true;

    const apply = (user: User | null | undefined) => {
      if (!mounted) return;
      const next = user ? viewerFromUser(user) : null;
      // Keep the same object across token refreshes so consumers do not re-fetch.
      setViewer((prev) =>
        prev?.id === next?.id &&
        prev?.name === next?.name &&
        prev?.avatarUrl === next?.avatarUrl
          ? prev
          : next
      );
      setLoading(false);
    };

    sb.auth.getSession().then(({ data }) => apply(data.session?.user));
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      // Supabase also fires INITIAL_SESSION, which resolves the first read too.
      apply(session?.user);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { viewer, loading };
}
